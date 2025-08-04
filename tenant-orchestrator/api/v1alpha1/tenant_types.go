package v1alpha1

import (
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
)

// +kubebuilder:deepcopy
type TenantSpec struct {
    // Name of the tenant organization
    OrganizationName string `json:"organizationName"`
    // Tier determines resource allocation
    // +kubebuilder:validation:Enum=starter;professional;enterprise
    Tier string `json:"tier"`
    // Resources configuration
    Resources ResourceSpec `json:"resources"`
    // Services to enable for this tenant
    Services []ServiceSpec `json:"services"`
    // Database configuration
    Database DatabaseSpec `json:"database"`
    // Domain configuration
    Domains []string `json:"domains,omitempty"`
    // Feature flags
    Features map[string]bool `json:"features,omitempty"`
}

// +kubebuilder:deepcopy
type ResourceSpec struct {
    // CPU limits and requests
    CPU ResourceQuantity `json:"cpu"`
    // Memory limits and requests
    Memory ResourceQuantity `json:"memory"`
    // Storage configuration
    Storage StorageSpec `json:"storage"`
}

// +kubebuilder:deepcopy
type ResourceQuantity struct {
    Request string `json:"request"`
    Limit   string `json:"limit"`
}

// +kubebuilder:deepcopy
type StorageSpec struct {
    // Size of persistent volume
    Size         string `json:"size"`
    // Storage class name
    StorageClass string `json:"storageClass,omitempty"`
}

// +kubebuilder:deepcopy
type ServiceSpec struct {
    // Name of the service
    Name string `json:"name"`
    // Version to deploy
    Version string `json:"version"`
    // Replicas count
    Replicas int32 `json:"replicas"`
    // Environment variables
    Env []corev1.EnvVar `json:"env,omitempty"`
    // Service-specific configuration
    Config map[string]string `json:"config,omitempty"`
}

// +kubebuilder:deepcopy
type DatabaseSpec struct {
    // Type of database (postgres, mysql)
    // +kubebuilder:validation:Enum=postgres;mysql
    Type string `json:"type"`
    // Version of database
    Version string `json:"version"`
    // Connection pooling configuration
    PoolSize int32 `json:"poolSize,omitempty"`
    // Backup configuration
    Backup BackupSpec `json:"backup,omitempty"`
}

// +kubebuilder:deepcopy
type BackupSpec struct {
    // Enable automatic backups
    Enabled bool `json:"enabled"`
    // Backup schedule (cron format)
    Schedule string `json:"schedule,omitempty"`
    // Retention days
    RetentionDays int32 `json:"retentionDays,omitempty"`
}

// +kubebuilder:deepcopy
type TenantStatus struct {
    // Current phase of the tenant
    // +kubebuilder:validation:Enum=Pending;Provisioning;Active;Failed;Terminating
    Phase string `json:"phase"`
    // Conditions represent the latest available observations
    Conditions []metav1.Condition `json:"conditions,omitempty"`
    // Service statuses
    Services []ServiceStatus `json:"services,omitempty"`
    // Database connection details
    DatabaseStatus DatabaseStatus `json:"databaseStatus,omitempty"`
    // Resource usage metrics
    ResourceMetrics ResourceMetrics `json:"resourceMetrics,omitempty"`
    // Last reconciliation timestamp
    LastReconciled *metav1.Time `json:"lastReconciled,omitempty"`
    // Tenant URL
    URL string `json:"url,omitempty"`
}

// +kubebuilder:deepcopy
type ServiceStatus struct {
    Name        string       `json:"name"`
    Ready       bool         `json:"ready"`
    Replicas    int32        `json:"replicas"`
    Version     string       `json:"version"`
    Endpoints   []string     `json:"endpoints,omitempty"`
    LastUpdated *metav1.Time `json:"lastUpdated,omitempty"`
}

// +kubebuilder:deepcopy
type DatabaseStatus struct {
    Ready          bool         `json:"ready"`
    ConnectionURL  string       `json:"connectionUrl,omitempty"`
    MigrationsRun  bool         `json:"migrationsRun"`
    LastBackupTime *metav1.Time `json:"lastBackupTime,omitempty"`
}

// +kubebuilder:deepcopy
type ResourceMetrics struct {
    CPUUsage    string       `json:"cpuUsage,omitempty"`
    MemoryUsage string       `json:"memoryUsage,omitempty"`
    StorageUsage string       `json:"storageUsage,omitempty"`
    UpdatedAt   *metav1.Time `json:"updatedAt,omitempty"`
}

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status
// +kubebuilder:resource:scope=Namespaced
// +kubebuilder:printcolumn:name="Organization",type=string,JSONPath=`.spec.organizationName`
// +kubebuilder:printcolumn:name="Tier",type=string,JSONPath=`.spec.tier`
// +kubebuilder:printcolumn:name="Phase",type=string,JSONPath=`.status.phase`
// +kubebuilder:printcolumn:name="Age",type=date,JSONPath=`.metadata.creationTimestamp`
// Tenant is the Schema for the tenants API
type Tenant struct {
    metav1.TypeMeta   `json:",inline"`
    metav1.ObjectMeta `json:"metadata,omitempty"`
    Spec              TenantSpec   `json:"spec,omitempty"`
    Status            TenantStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true
// TenantList contains a list of Tenant
type TenantList struct {
    metav1.TypeMeta `json:",inline"`
    metav1.ListMeta `json:"metadata,omitempty"`
    Items           []Tenant `json:"items"`
}

// SchemeGroupVersion is the group version used to register these objects
var SchemeGroupVersion = schema.GroupVersion{Group: "multi-saas-crm.rezenkai.com", Version: "v1alpha1"}

// SchemeBuilder is used to register CRD types
var SchemeBuilder = runtime.NewSchemeBuilder(addKnownTypes)

// AddToScheme adds the CRD types to a scheme
var AddToScheme = SchemeBuilder.AddToScheme

// Scheme defines methods for serializing and deserializing API objects.
var Scheme = runtime.NewScheme()

// addKnownTypes adds the set of types defined in this package to the supplied scheme.
func addKnownTypes(scheme *runtime.Scheme) error {
    scheme.AddKnownTypes(SchemeGroupVersion,
        &Tenant{},
        &TenantList{},
    )
    metav1.AddToGroupVersion(scheme, SchemeGroupVersion)
    return nil
}

func init() {
    // Add the core Kubernetes types to the scheme
    utilruntime.Must(clientgoscheme.AddToScheme(Scheme))
    
    // Register our known types
    SchemeBuilder.Register(addKnownTypes)
    
    // Add our types to the scheme
    utilruntime.Must(AddToScheme(Scheme))
}

// DeepCopyInto is a manual deepcopy function for Tenant.
func (in *Tenant) DeepCopyInto(out *Tenant) {
    *out = *in
    out.TypeMeta = in.TypeMeta
    in.ObjectMeta.DeepCopyInto(&out.ObjectMeta)
    in.Spec.DeepCopyInto(&out.Spec)
    in.Status.DeepCopyInto(&out.Status)
}

// DeepCopy creates a deep copy of the Tenant.
func (in *Tenant) DeepCopy() *Tenant {
    if in == nil {
        return nil
    }
    out := new(Tenant)
    in.DeepCopyInto(out)
    return out
}

// DeepCopyObject implements the runtime.Object interface for Tenant.
func (in *Tenant) DeepCopyObject() runtime.Object {
    if c := in.DeepCopy(); c != nil {
        return c
    }
    return nil
}

// DeepCopyInto is a manual deepcopy function for TenantList.
func (in *TenantList) DeepCopyInto(out *TenantList) {
    *out = *in
    out.TypeMeta = in.TypeMeta
    in.ListMeta.DeepCopyInto(&out.ListMeta)
    if in.Items != nil {
        inItems, outItems := &in.Items, &out.Items
        *outItems = make([]Tenant, len(*inItems))
        for i := range *inItems {
            (*inItems)[i].DeepCopyInto(&(*outItems)[i])
        }
    }
}

// DeepCopy creates a deep copy of the TenantList.
func (in *TenantList) DeepCopy() *TenantList {
    if in == nil {
        return nil
    }
    out := new(TenantList)
    in.DeepCopyInto(out)
    return out
}

// DeepCopyObject implements the runtime.Object interface for TenantList.
func (in *TenantList) DeepCopyObject() runtime.Object {
    if c := in.DeepCopy(); c != nil {
        return c
    }
    return nil
}

// DeepCopyInto is a manual deepcopy function for TenantSpec.
func (in *TenantSpec) DeepCopyInto(out *TenantSpec) {
    *out = *in
    out.OrganizationName = in.OrganizationName
    out.Tier = in.Tier
    out.Resources.DeepCopyInto(&out.Resources)
    if in.Services != nil {
        out.Services = make([]ServiceSpec, len(in.Services))
        for i := range in.Services {
            in.Services[i].DeepCopyInto(&out.Services[i])
        }
    }
    out.Database.DeepCopyInto(&out.Database)
    if in.Domains != nil {
        out.Domains = make([]string, len(in.Domains))
        copy(out.Domains, in.Domains)
    }
    if in.Features != nil {
        out.Features = make(map[string]bool, len(in.Features))
        for k, v := range in.Features {
            out.Features[k] = v
        }
    }
}

// DeepCopyInto is a manual deepcopy function for TenantStatus.
func (in *TenantStatus) DeepCopyInto(out *TenantStatus) {
    *out = *in
    out.Phase = in.Phase
    if in.Conditions != nil {
        out.Conditions = make([]metav1.Condition, len(in.Conditions))
        for i := range in.Conditions {
            in.Conditions[i].DeepCopyInto(&out.Conditions[i])
        }
    }
    if in.Services != nil {
        out.Services = make([]ServiceStatus, len(in.Services))
        for i := range in.Services {
            in.Services[i].DeepCopyInto(&out.Services[i])
        }
    }
    out.DatabaseStatus.DeepCopyInto(&out.DatabaseStatus)
    out.ResourceMetrics.DeepCopyInto(&out.ResourceMetrics)
    if in.LastReconciled != nil {
        out.LastReconciled = in.LastReconciled.DeepCopy()
    }
    out.URL = in.URL
}

// DeepCopyInto is a manual deepcopy function for ResourceSpec.
func (in *ResourceSpec) DeepCopyInto(out *ResourceSpec) {
    *out = *in
    out.CPU.DeepCopyInto(&out.CPU)
    out.Memory.DeepCopyInto(&out.Memory)
    out.Storage.DeepCopyInto(&out.Storage)
}

// DeepCopyInto is a manual deepcopy function for ResourceQuantity.
func (in *ResourceQuantity) DeepCopyInto(out *ResourceQuantity) {
    *out = *in
    out.Request = in.Request
    out.Limit = in.Limit
}

// DeepCopyInto is a manual deepcopy function for StorageSpec.
func (in *StorageSpec) DeepCopyInto(out *StorageSpec) {
    *out = *in
    out.Size = in.Size
    out.StorageClass = in.StorageClass
}

// DeepCopyInto is a manual deepcopy function for ServiceSpec.
func (in *ServiceSpec) DeepCopyInto(out *ServiceSpec) {
    *out = *in
    out.Name = in.Name
    out.Version = in.Version
    out.Replicas = in.Replicas
    if in.Env != nil {
        out.Env = make([]corev1.EnvVar, len(in.Env))
        for i := range in.Env {
            in.Env[i].DeepCopyInto(&out.Env[i])
        }
    }
    if in.Config != nil {
        out.Config = make(map[string]string, len(in.Config))
        for k, v := range in.Config {
            out.Config[k] = v
        }
    }
}

// DeepCopyInto is a manual deepcopy function for DatabaseSpec.
func (in *DatabaseSpec) DeepCopyInto(out *DatabaseSpec) {
    *out = *in
    out.Type = in.Type
    out.Version = in.Version
    out.PoolSize = in.PoolSize
    out.Backup.DeepCopyInto(&out.Backup)
}

// DeepCopyInto is a manual deepcopy function for BackupSpec.
func (in *BackupSpec) DeepCopyInto(out *BackupSpec) {
    *out = *in
    out.Enabled = in.Enabled
    out.Schedule = in.Schedule
    out.RetentionDays = in.RetentionDays
}

// DeepCopyInto is a manual deepcopy function for ServiceStatus.
func (in *ServiceStatus) DeepCopyInto(out *ServiceStatus) {
    *out = *in
    out.Name = in.Name
    out.Ready = in.Ready
    out.Replicas = in.Replicas
    out.Version = in.Version
    if in.Endpoints != nil {
        out.Endpoints = make([]string, len(in.Endpoints))
        copy(out.Endpoints, in.Endpoints)
    }
    if in.LastUpdated != nil {
        out.LastUpdated = in.LastUpdated.DeepCopy()
    }
}

// DeepCopyInto is a manual deepcopy function for DatabaseStatus.
func (in *DatabaseStatus) DeepCopyInto(out *DatabaseStatus) {
    *out = *in
    out.Ready = in.Ready
    out.ConnectionURL = in.ConnectionURL
    out.MigrationsRun = in.MigrationsRun
    if in.LastBackupTime != nil {
        out.LastBackupTime = in.LastBackupTime.DeepCopy()
    }
}

// DeepCopyInto is a manual deepcopy function for ResourceMetrics.
func (in *ResourceMetrics) DeepCopyInto(out *ResourceMetrics) {
    *out = *in
    out.CPUUsage = in.CPUUsage
    out.MemoryUsage = in.MemoryUsage
    out.StorageUsage = in.StorageUsage
    if in.UpdatedAt != nil {
        out.UpdatedAt = in.UpdatedAt.DeepCopy()
    }
}