package controllers

import (
	"context"
	"fmt"
	"time"

	tenantv1alpha1 "github.com/rezenkai/multi-saas-crm/tenant-orchestrator/api/v1alpha1"
	"github.com/rezenkai/multi-saas-crm/tenant-orchestrator/pkg/discovery"
	"github.com/rezenkai/multi-saas-crm/tenant-orchestrator/pkg/health"
	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/tools/record"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
)

const (
	tenantFinalizer = "tenant.rezenkai.com/finalizer"
	ownerKey        = ".metadata.controller"
	apiVersion      = "tenant.rezenkai.com/v1alpha1"
)

// TenantReconciler reconciles a Tenant object
type TenantReconciler struct {
	client.Client
	Scheme        *runtime.Scheme
	Discovery     *discovery.Client
	HealthMonitor *health.Monitor
	EventRecorder record.EventRecorder
}

// +kubebuilder:rbac:groups=tenant.rezenkai.com,resources=tenants,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=tenant.rezenkai.com,resources=tenants/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=tenant.rezenkai.com,resources=tenants/finalizers,verbs=update
// +kubebuilder:rbac:groups=apps,resources=deployments;statefulsets,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=core,resources=services;configmaps;secrets;persistentvolumeclaims,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=networking.k8s.io,resources=ingresses,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=batch,resources=jobs,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups="",resources=events,verbs=create;patch

func (r *TenantReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := log.FromContext(ctx).WithValues("tenant", req.NamespacedName)

	// Fetch the Tenant instance
	tenant := &tenantv1alpha1.Tenant{}
	if err := r.Get(ctx, req.NamespacedName, tenant); err != nil {
		if errors.IsNotFound(err) {
			log.Info("Tenant resource not found. Ignoring since object must be deleted")
			return ctrl.Result{}, nil
		}
		log.Error(err, "Failed to get Tenant")
		return ctrl.Result{}, err
	}

	// Handle deletion
	if !tenant.ObjectMeta.DeletionTimestamp.IsZero() {
		return r.handleDeletion(ctx, tenant)
	}

	// Add finalizer if not present
	if !controllerutil.ContainsFinalizer(tenant, tenantFinalizer) {
		controllerutil.AddFinalizer(tenant, tenantFinalizer)
		if err := r.Update(ctx, tenant); err != nil {
			return ctrl.Result{}, err
		}
	}

	// Reconcile tenant resources
	result, err := r.reconcileTenant(ctx, tenant)
	if err != nil {
		r.EventRecorder.Event(tenant, corev1.EventTypeWarning, "ReconcileError", err.Error())
		return result, err
	}

	// Update status
	tenant.Status.LastReconciled = &metav1.Time{Time: time.Now()}
	if err := r.Status().Update(ctx, tenant); err != nil {
		log.Error(err, "Failed to update Tenant status")
		return ctrl.Result{}, err
	}

	return result, nil
}

func (r *TenantReconciler) reconcileTenant(ctx context.Context, tenant *tenantv1alpha1.Tenant) (ctrl.Result, error) {
	log := log.FromContext(ctx).WithValues("tenant", tenant.Name)

	// Update phase to provisioning if pending
	if tenant.Status.Phase == "" || tenant.Status.Phase == "Pending" {
		tenant.Status.Phase = "Provisioning"
		r.EventRecorder.Event(tenant, corev1.EventTypeNormal, "Provisioning", "Starting tenant provisioning")
	}

	// Create namespace if it doesn't exist
	if err := r.ensureNamespace(ctx, tenant); err != nil {
		return ctrl.Result{}, err
	}

	// Deploy database
	if err := r.reconcileDatabase(ctx, tenant); err != nil {
		meta.SetStatusCondition(&tenant.Status.Conditions, metav1.Condition{
			Type:    "DatabaseReady",
			Status:  metav1.ConditionFalse,
			Reason:  "DatabaseError",
			Message: err.Error(),
		})
		return ctrl.Result{RequeueAfter: 30 * time.Second}, err
	}

	// Deploy services
	for _, svc := range tenant.Spec.Services {
		if err := r.reconcileService(ctx, tenant, svc); err != nil {
			log.Error(err, "Failed to reconcile service", "service", svc.Name)
			return ctrl.Result{RequeueAfter: 30 * time.Second}, err
		}
	}

	// Configure backups
	if tenant.Spec.Database.Backup.Enabled {
		if err := r.reconcileBackup(ctx, tenant); err != nil {
			meta.SetStatusCondition(&tenant.Status.Conditions, metav1.Condition{
				Type:    "BackupReady",
				Status:  metav1.ConditionFalse,
				Reason:  "BackupError",
				Message: err.Error(),
			})
			return ctrl.Result{RequeueAfter: 30 * time.Second}, err
		}
		meta.SetStatusCondition(&tenant.Status.Conditions, metav1.Condition{
			Type:    "BackupReady",
			Status:  metav1.ConditionTrue,
			Reason:  "BackupProvisioned",
			Message: "Backups are configured",
		})
	}

	// Create ingress
	if err := r.reconcileIngress(ctx, tenant); err != nil {
		return ctrl.Result{RequeueAfter: 30 * time.Second}, err
	}

	// Run health checks
	healthy, err := r.HealthMonitor.CheckTenantHealth(ctx, tenant)
	if err != nil {
		log.Error(err, "Health check failed")
		return ctrl.Result{RequeueAfter: 1 * time.Minute}, nil
	}
	if healthy {
		tenant.Status.Phase = "Active"
		r.EventRecorder.Event(tenant, corev1.EventTypeNormal, "Active", "Tenant is active and healthy")
	}

	// Update service discovery
	if err := r.Discovery.UpdateServiceEndpoints(ctx, tenant); err != nil {
		log.Error(err, "Failed to update service discovery")
	}

	// Requeue for periodic health checks
	return ctrl.Result{RequeueAfter: 5 * time.Minute}, nil
}

func (r *TenantReconciler) ensureNamespace(ctx context.Context, tenant *tenantv1alpha1.Tenant) error {
	ns := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: fmt.Sprintf("tenant-%s", tenant.Name),
			Labels: map[string]string{
				"tenant.rezenkai.com/name": tenant.Name,
				"tenant.rezenkai.com/tier": tenant.Spec.Tier,
			},
		},
	}
	if err := r.Create(ctx, ns); err != nil && !errors.IsAlreadyExists(err) {
		return err
	}
	return nil
}

func (r *TenantReconciler) reconcileDatabase(ctx context.Context, tenant *tenantv1alpha1.Tenant) error {
	// Create database secret
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%s-db-credentials", tenant.Name),
			Namespace: fmt.Sprintf("tenant-%s", tenant.Name),
		},
		Type: corev1.SecretTypeOpaque,
		Data: map[string][]byte{
			"username": []byte(fmt.Sprintf("tenant_%s", tenant.Name)),
			"password": []byte(generatePassword()),
			"database": []byte(fmt.Sprintf("tenant_%s_db", tenant.Name)),
		},
	}
	if err := controllerutil.SetControllerReference(tenant, secret, r.Scheme); err != nil {
		return err
	}
	if err := r.Create(ctx, secret); err != nil && !errors.IsAlreadyExists(err) {
		return err
	}

	// Deploy database StatefulSet
	statefulSet := r.databaseStatefulSet(tenant)
	if err := controllerutil.SetControllerReference(tenant, statefulSet, r.Scheme); err != nil {
		return err
	}
	found := &appsv1.StatefulSet{}
	err := r.Get(ctx, types.NamespacedName{Name: statefulSet.Name, Namespace: statefulSet.Namespace}, found)
	if err != nil && errors.IsNotFound(err) {
		log.FromContext(ctx).Info("Creating database StatefulSet", "Name", statefulSet.Name)
		err = r.Create(ctx, statefulSet)
		if err != nil {
			return err
		}
	} else if err != nil {
		return err
	}

	// Update database status
	tenant.Status.DatabaseStatus.ConnectionURL = fmt.Sprintf("%s-db-svc.tenant-%s.svc.cluster.local:5432/%s",
		tenant.Name, tenant.Name, fmt.Sprintf("tenant_%s_db", tenant.Name))
	meta.SetStatusCondition(&tenant.Status.Conditions, metav1.Condition{
		Type:    "DatabaseReady",
		Status:  metav1.ConditionTrue,
		Reason:  "DatabaseProvisioned",
		Message: "Database is provisioned and ready",
	})
	return nil
}

func (r *TenantReconciler) reconcileBackup(ctx context.Context, tenant *tenantv1alpha1.Tenant) error {
	log := log.FromContext(ctx).WithValues("tenant", tenant.Name)

	// Handle manual backup request
	if backupName, ok := tenant.Annotations["tenant.rezenkai.com/backup-request"]; ok {
		log.Info("Processing backup request", "backup", backupName)
		job := r.createBackupJob(tenant, backupName)
		if err := controllerutil.SetOwnerReference(tenant, job, r.Scheme); err != nil {
			return err
		}
		if err := r.Create(ctx, job); err != nil && !errors.IsAlreadyExists(err) {
			return err
		}
		delete(tenant.Annotations, "tenant.rezenkai.com/backup-request")
		if err := r.Update(ctx, tenant); err != nil {
			return err
		}
		tenant.Status.DatabaseStatus.LastBackupTime = &metav1.Time{Time: time.Now()}
		if err := r.Status().Update(ctx, tenant); err != nil {
			return err
		}
		r.EventRecorder.Event(tenant, corev1.EventTypeNormal, "BackupStarted", fmt.Sprintf("Backup %s started", backupName))
	}

	// Handle restore request
	if restoreName, ok := tenant.Annotations["tenant.rezenkai.com/restore-request"]; ok {
		log.Info("Processing restore request", "restore", restoreName)
		job := r.createRestoreJob(tenant, restoreName)
		if err := controllerutil.SetOwnerReference(tenant, job, r.Scheme); err != nil {
			return err
		}
		if err := r.Create(ctx, job); err != nil && !errors.IsAlreadyExists(err) {
			return err
		}
		delete(tenant.Annotations, "tenant.rezenkai.com/restore-request")
		if err := r.Update(ctx, tenant); err != nil {
			return err
		}
		tenant.Status.DatabaseStatus.LastRestoreTime = &metav1.Time{Time: time.Now()}
		if err := r.Status().Update(ctx, tenant); err != nil {
			return err
		}
		r.EventRecorder.Event(tenant, corev1.EventTypeNormal, "RestoreStarted", fmt.Sprintf("Restore %s started", restoreName))
	}

	return nil
}

func (r *TenantReconciler) createBackupJob(tenant *tenantv1alpha1.Tenant, backupName string) *batchv1.Job {
	labels := map[string]string{"app": "backup", "tenant": tenant.Name}
	dbType := tenant.Spec.Database.Type
	command := []string{"pg_dump"}
	args := []string{
		"-h", fmt.Sprintf("%s-db-svc", tenant.Name),
		"-U", fmt.Sprintf("tenant_%s", tenant.Name),
		"-d", fmt.Sprintf("tenant_%s_db", tenant.Name),
		"--file", fmt.Sprintf("/backup/%s.sql", backupName),
	}
	if dbType == "mysql" {
		command = []string{"mysqldump"}
		args = []string{
			"-h", fmt.Sprintf("%s-db-svc", tenant.Name),
			"-u", fmt.Sprintf("tenant_%s", tenant.Name),
			"--databases", fmt.Sprintf("tenant_%s_db", tenant.Name),
			"--result-file", fmt.Sprintf("/backup/%s.sql", backupName),
		}
	}
	return &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%s-backup-%s", tenant.Name, backupName),
			Namespace: fmt.Sprintf("tenant-%s", tenant.Name),
			Labels:    labels,
		},
		Spec: batchv1.JobSpec{
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: labels},
				Spec: corev1.PodSpec{
					RestartPolicy: corev1.RestartPolicyOnFailure,
					Containers: []corev1.Container{
						{
							Name:    "backup",
							Image:   fmt.Sprintf("%s:%s", dbType, tenant.Spec.Database.Version),
							Command: command,
							Args:    args,
							Env: []corev1.EnvVar{
								{
									Name: "PGPASSWORD",
									ValueFrom: &corev1.EnvVarSource{
										SecretKeyRef: &corev1.SecretKeySelector{
											LocalObjectReference: corev1.LocalObjectReference{Name: fmt.Sprintf("%s-db-credentials", tenant.Name)},
											Key:                  "password",
										},
									},
								},
							},
							VolumeMounts: []corev1.VolumeMount{{Name: "backup-vol", MountPath: "/backup"}},
						},
						{
							Name:    "uploader",
							Image:   "amazon/aws-cli:latest",
							Command: []string{"aws", "s3", "cp", fmt.Sprintf("/backup/%s.sql", backupName), fmt.Sprintf("s3://multi-saas-crm-backups/%s/%s.sql", tenant.Name, backupName)},
							Env: []corev1.EnvVar{
								{Name: "AWS_ACCESS_KEY_ID", ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{LocalObjectReference: corev1.LocalObjectReference{Name: "aws-credentials"}, Key: "access-key-id"}}},
								{Name: "AWS_SECRET_ACCESS_KEY", ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{LocalObjectReference: corev1.LocalObjectReference{Name: "aws-credentials"}, Key: "secret-access-key"}}},
							},
							VolumeMounts: []corev1.VolumeMount{{Name: "backup-vol", MountPath: "/backup"}},
						},
					},
					Volumes: []corev1.Volume{
						{Name: "backup-vol", VolumeSource: corev1.VolumeSource{EmptyDir: &corev1.EmptyDirVolumeSource{}}},
					},
				},
			},
		},
	}
}

func (r *TenantReconciler) createRestoreJob(tenant *tenantv1alpha1.Tenant, restoreName string) *batchv1.Job {
	labels := map[string]string{"app": "restore", "tenant": tenant.Name}
	dbType := tenant.Spec.Database.Type
	command := []string{"pg_restore"}
	args := []string{
		"-h", fmt.Sprintf("%s-db-svc", tenant.Name),
		"-U", fmt.Sprintf("tenant_%s", tenant.Name),
		"-d", fmt.Sprintf("tenant_%s_db", tenant.Name),
		fmt.Sprintf("/backup/%s.sql", restoreName),
	}
	if dbType == "mysql" {
		command = []string{"mysql"}
		args = []string{
			"-h", fmt.Sprintf("%s-db-svc", tenant.Name),
			"-u", fmt.Sprintf("tenant_%s", tenant.Name),
			fmt.Sprintf("tenant_%s_db", tenant.Name),
		}
	}
	return &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%s-restore-%s", tenant.Name, restoreName),
			Namespace: fmt.Sprintf("tenant-%s", tenant.Name),
			Labels:    labels,
		},
		Spec: batchv1.JobSpec{
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: labels},
				Spec: corev1.PodSpec{
					RestartPolicy: corev1.RestartPolicyOnFailure,
					Containers: []corev1.Container{
						{
							Name:    "downloader",
							Image:   "amazon/aws-cli:latest",
							Command: []string{"aws", "s3", "cp", fmt.Sprintf("s3://multi-saas-crm-backups/%s/%s.sql", tenant.Name, restoreName), fmt.Sprintf("/backup/%s.sql", restoreName)},
							Env: []corev1.EnvVar{
								{Name: "AWS_ACCESS_KEY_ID", ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{LocalObjectReference: corev1.LocalObjectReference{Name: "aws-credentials"}, Key: "access-key-id"}}},
								{Name: "AWS_SECRET_ACCESS_KEY", ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{LocalObjectReference: corev1.LocalObjectReference{Name: "aws-credentials"}, Key: "secret-access-key"}}},
							},
							VolumeMounts: []corev1.VolumeMount{{Name: "backup-vol", MountPath: "/backup"}},
						},
						{
							Name:    "restore",
							Image:   fmt.Sprintf("%s:%s", dbType, tenant.Spec.Database.Version),
							Command: command,
							Args:    args,
							Env: []corev1.EnvVar{
								{
									Name: "PGPASSWORD",
									ValueFrom: &corev1.EnvVarSource{
										SecretKeyRef: &corev1.SecretKeySelector{
											LocalObjectReference: corev1.LocalObjectReference{Name: fmt.Sprintf("%s-db-credentials", tenant.Name)},
											Key:                  "password",
										},
									},
								},
							},
							VolumeMounts: []corev1.VolumeMount{{Name: "backup-vol", MountPath: "/backup"}},
						},
					},
					Volumes: []corev1.Volume{
						{Name: "backup-vol", VolumeSource: corev1.VolumeSource{EmptyDir: &corev1.EmptyDirVolumeSource{}}},
					},
				},
			},
		},
	}
}

func (r *TenantReconciler) reconcileService(ctx context.Context, tenant *tenantv1alpha1.Tenant, svc tenantv1alpha1.ServiceSpec) error {
	deployment := r.serviceDeployment(tenant, svc)
	if err := controllerutil.SetControllerReference(tenant, deployment, r.Scheme); err != nil {
		return err
	}
	found := &appsv1.Deployment{}
	err := r.Get(ctx, types.NamespacedName{Name: deployment.Name, Namespace: deployment.Namespace}, found)
	if err != nil && errors.IsNotFound(err) {
		log.FromContext(ctx).Info("Creating service deployment", "Name", deployment.Name)
		err = r.Create(ctx, deployment)
		if err != nil {
			return err
		}
		r.EventRecorder.Event(tenant, corev1.EventTypeNormal, "ServiceDeployed",
			fmt.Sprintf("Service %s deployed", svc.Name))
	} else if err != nil {
		return err
	} else {
		// Update deployment if spec changed
		if !deploymentEqual(found, deployment) {
			found.Spec = deployment.Spec
			err = r.Update(ctx, found)
			if err != nil {
				return err
			}
		}
	}

	// Create service
	service := r.kubernetesService(tenant, svc)
	if err := controllerutil.SetControllerReference(tenant, service, r.Scheme); err != nil {
		return err
	}
	if err := r.Create(ctx, service); err != nil && !errors.IsAlreadyExists(err) {
		return err
	}

	// Update service status
	serviceStatus := tenantv1alpha1.ServiceStatus{
		Name:        svc.Name,
		Version:     svc.Version,
		Replicas:    svc.Replicas,
		LastUpdated: &metav1.Time{Time: time.Now()},
	}
	// Check if deployment is ready
	if found.Status.ReadyReplicas == *found.Spec.Replicas {
		serviceStatus.Ready = true
	}
	// Update or append service status
	updated := false
	for i, s := range tenant.Status.Services {
		if s.Name == svc.Name {
			tenant.Status.Services[i] = serviceStatus
			updated = true
			break
		}
	}
	if !updated {
		tenant.Status.Services = append(tenant.Status.Services, serviceStatus)
	}
	return nil
}

func (r *TenantReconciler) reconcileIngress(ctx context.Context, tenant *tenantv1alpha1.Tenant) error {
	if len(tenant.Spec.Domains) == 0 {
		return nil
	}
	ingress := r.tenantIngress(tenant)
	if err := controllerutil.SetControllerReference(tenant, ingress, r.Scheme); err != nil {
		return err
	}
	if err := r.Create(ctx, ingress); err != nil && !errors.IsAlreadyExists(err) {
		return err
	}
	// Update tenant URL
	if len(tenant.Spec.Domains) > 0 {
		tenant.Status.URL = fmt.Sprintf("https://%s", tenant.Spec.Domains[0])
	}
	return nil
}

func (r *TenantReconciler) handleDeletion(ctx context.Context, tenant *tenantv1alpha1.Tenant) (ctrl.Result, error) {
	if controllerutil.ContainsFinalizer(tenant, tenantFinalizer) {
		// Update status
		tenant.Status.Phase = "Terminating"
		r.EventRecorder.Event(tenant, corev1.EventTypeNormal, "Terminating", "Starting tenant termination")
		// Perform cleanup
		if err := r.cleanupTenantResources(ctx, tenant); err != nil {
			return ctrl.Result{}, err
		}
		// Remove finalizer
		controllerutil.RemoveFinalizer(tenant, tenantFinalizer)
		if err := r.Update(ctx, tenant); err != nil {
			return ctrl.Result{}, err
		}
	}
	return ctrl.Result{}, nil
}

func (r *TenantReconciler) cleanupTenantResources(ctx context.Context, tenant *tenantv1alpha1.Tenant) error {
	log.FromContext(ctx).Info("Cleaning up tenant resources", "tenant", tenant.Name)
	// Remove from service discovery
	if err := r.Discovery.RemoveTenant(ctx, tenant); err != nil {
		log.FromContext(ctx).Error(err, "Failed to remove tenant from service discovery")
	}
	return nil
}

// Helper functions for creating Kubernetes resources
func (r *TenantReconciler) databaseStatefulSet(tenant *tenantv1alpha1.Tenant) *appsv1.StatefulSet {
	replicas := int32(1)
	labels := map[string]string{
		"app":    "postgres",
		"tenant": tenant.Name,
	}
	return &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%s-db", tenant.Name),
			Namespace: fmt.Sprintf("tenant-%s", tenant.Name),
		},
		Spec: appsv1.StatefulSetSpec{
			Replicas: &replicas,
			Selector: &metav1.LabelSelector{
				MatchLabels: labels,
			},
			ServiceName: fmt.Sprintf("%s-db-svc", tenant.Name),
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: labels,
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{
							Name:  "postgres",
							Image: fmt.Sprintf("postgres:%s", tenant.Spec.Database.Version),
							Ports: []corev1.ContainerPort{
								{ContainerPort: 5432, Name: "postgres"},
							},
							Env: []corev1.EnvVar{
								{
									Name: "POSTGRES_USER",
									ValueFrom: &corev1.EnvVarSource{
										SecretKeyRef: &corev1.SecretKeySelector{
											LocalObjectReference: corev1.LocalObjectReference{Name: fmt.Sprintf("%s-db-credentials", tenant.Name)},
											Key:                  "username",
										},
									},
								},
								{
									Name: "POSTGRES_PASSWORD",
									ValueFrom: &corev1.EnvVarSource{
										SecretKeyRef: &corev1.SecretKeySelector{
											LocalObjectReference: corev1.LocalObjectReference{Name: fmt.Sprintf("%s-db-credentials", tenant.Name)},
											Key:                  "password",
										},
									},
								},
								{
									Name: "POSTGRES_DB",
									ValueFrom: &corev1.EnvVarSource{
										SecretKeyRef: &corev1.SecretKeySelector{
											LocalObjectReference: corev1.LocalObjectReference{Name: fmt.Sprintf("%s-db-credentials", tenant.Name)},
											Key:                  "database",
										},
									},
								},
							},
							VolumeMounts: []corev1.VolumeMount{
								{Name: "postgres-storage", MountPath: "/var/lib/postgresql/data"},
							},
						},
					},
				},
			},
			VolumeClaimTemplates: []corev1.PersistentVolumeClaim{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "postgres-storage"},
					Spec: corev1.PersistentVolumeClaimSpec{
						AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
						Resources: corev1.ResourceRequirements{
							Requests: corev1.ResourceList{
								corev1.ResourceStorage: resource.MustParse(tenant.Spec.Resources.Storage.Size),
							},
						},
					},
				},
			},
		},
	}
}

func (r *TenantReconciler) serviceDeployment(tenant *tenantv1alpha1.Tenant, svc tenantv1alpha1.ServiceSpec) *appsv1.Deployment {
	labels := map[string]string{
		"app":     svc.Name,
		"tenant":  tenant.Name,
		"version": svc.Version,
	}
	return &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%s-%s", tenant.Name, svc.Name),
			Namespace: fmt.Sprintf("tenant-%s", tenant.Name),
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: &svc.Replicas,
			Selector: &metav1.LabelSelector{
				MatchLabels: labels,
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: labels},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{
							Name:  svc.Name,
							Image: fmt.Sprintf("rezenkai/%s:%s", svc.Name, svc.Version),
							Ports: []corev1.ContainerPort{{ContainerPort: 8080, Name: "http"}},
							Env: append(svc.Env,
								corev1.EnvVar{Name: "TENANT_ID", Value: tenant.Name},
								corev1.EnvVar{
									Name:  "DB_HOST",
									Value: fmt.Sprintf("%s-db-svc.tenant-%s.svc.cluster.local", tenant.Name, tenant.Name),
								},
							),
							Resources: corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse(tenant.Spec.Resources.CPU.Request),
									corev1.ResourceMemory: resource.MustParse(tenant.Spec.Resources.Memory.Request),
								},
								Limits: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse(tenant.Spec.Resources.CPU.Limit),
									corev1.ResourceMemory: resource.MustParse(tenant.Spec.Resources.Memory.Limit),
								},
							},
						},
					},
				},
			},
		},
	}
}

func (r *TenantReconciler) kubernetesService(tenant *tenantv1alpha1.Tenant, svc tenantv1alpha1.ServiceSpec) *corev1.Service {
	labels := map[string]string{
		"app":    svc.Name,
		"tenant": tenant.Name,
	}
	return &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%s-%s-svc", tenant.Name, svc.Name),
			Namespace: fmt.Sprintf("tenant-%s", tenant.Name),
			Labels:    labels,
		},
		Spec: corev1.ServiceSpec{
			Selector: labels,
			Type:     corev1.ServiceTypeClusterIP,
			Ports: []corev1.ServicePort{
				{
					Name:       "http",
					Port:       80,
					TargetPort: intstr.FromInt(8080),
					Protocol:   corev1.ProtocolTCP,
				},
			},
		},
	}
}

func (r *TenantReconciler) tenantIngress(tenant *tenantv1alpha1.Tenant) *networkingv1.Ingress {
	pathType := networkingv1.PathTypePrefix
	var rules []networkingv1.IngressRule
	for _, domain := range tenant.Spec.Domains {
		rules = append(rules, networkingv1.IngressRule{
			Host: domain,
			IngressRuleValue: networkingv1.IngressRuleValue{
				HTTP: &networkingv1.HTTPIngressRuleValue{
					Paths: []networkingv1.HTTPIngressPath{
						{
							Path:     "/",
							PathType: &pathType,
							Backend: networkingv1.IngressBackend{
								Service: &networkingv1.IngressServiceBackend{
									Name: fmt.Sprintf("%s-gateway-svc", tenant.Name),
									Port: networkingv1.ServiceBackendPort{Number: 80},
								},
							},
						},
					},
				},
			},
		})
	}
	return &networkingv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%s-ingress", tenant.Name),
			Namespace: fmt.Sprintf("tenant-%s", tenant.Name),
			Annotations: map[string]string{
				"kubernetes.io/ingress.class":               "nginx",
				"cert-manager.io/cluster-issuer":            "letsencrypt-prod",
				"nginx.ingress.kubernetes.io/ssl-redirect":  "true",
				"nginx.ingress.kubernetes.io/proxy-body-size": "100m",
			},
		},
		Spec: networkingv1.IngressSpec{
			TLS: []networkingv1.IngressTLS{
				{Hosts: tenant.Spec.Domains, SecretName: fmt.Sprintf("%s-tls", tenant.Name)},
			},
			Rules: rules,
		},
	}
}

func deploymentEqual(a, b *appsv1.Deployment) bool {
	return a.Spec.Template.Spec.Containers[0].Image == b.Spec.Template.Spec.Containers[0].Image &&
		*a.Spec.Replicas == *b.Spec.Replicas
}

func generatePassword() string {
	// TODO: Use crypto/rand for production
	return "SecurePassword123!"
}

func (r *TenantReconciler) SetupWithManager(mgr ctrl.Manager) error {
	if err := mgr.GetFieldIndexer().IndexField(context.Background(), &appsv1.Deployment{}, ownerKey, func(rawObj client.Object) []string {
		deployment := rawObj.(*appsv1.Deployment)
		owner := metav1.GetControllerOf(deployment)
		if owner == nil || owner.APIVersion != apiVersion || owner.Kind != "Tenant" {
			return nil
		}
		return []string{owner.Name}
	}); err != nil {
		return err
	}
	return ctrl.NewControllerManagedBy(mgr).
		For(&tenantv1alpha1.Tenant{}).
		Owns(&appsv1.Deployment{}).
		Owns(&appsv1.StatefulSet{}).
		Owns(&corev1.Service{}).
		Owns(&networkingv1.Ingress{}).
		Owns(&batchv1.Job{}).
		WithEventFilter(predicate.GenerationChangedPredicate{}).
		Complete(r)
}