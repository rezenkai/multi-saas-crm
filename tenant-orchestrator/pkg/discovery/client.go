package discovery

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	tenantv1alpha1 "github.com/rezenkai/multi-saas-crm/tenant-orchestrator/api/v1alpha1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
)

// ServiceEndpoint represents a discovered service endpoint
type ServiceEndpoint struct {
	Service   string            `json:"service"`
	Namespace string            `json:"namespace"`
	Tenant    string            `json:"tenant"`
	Address   string            `json:"address"`
	Port      int32             `json:"port"`
	Protocol  string            `json:"protocol"`
	Metadata  map[string]string `json:"metadata"`
	Health    HealthStatus      `json:"health"`
	UpdatedAt time.Time         `json:"updatedAt"`
}

// HealthStatus represents the health of a service endpoint
type HealthStatus struct {
	Status    string    `json:"status"` // healthy, unhealthy, unknown
	LastCheck time.Time `json:"lastCheck"`
	Message   string    `json:"message,omitempty"`
}

// Client provides service discovery functionality
type Client struct {
	client client.Client
	cache  *serviceCache
}

// serviceCache provides thread-safe caching of service endpoints
type serviceCache struct {
	mu        sync.RWMutex
	endpoints map[string][]ServiceEndpoint
	tenants   map[string]*tenantv1alpha1.Tenant
}

// NewClient creates a new service discovery client
func NewClient(c client.Client) *Client {
	return &Client{
		client: c,
		cache: &serviceCache{
			endpoints: make(map[string][]ServiceEndpoint),
			tenants:   make(map[string]*tenantv1alpha1.Tenant),
		},
	}
}

// UpdateServiceEndpoints updates the service registry for a tenant
func (d *Client) UpdateServiceEndpoints(ctx context.Context, tenant *tenantv1alpha1.Tenant) error {
	log := log.FromContext(ctx).WithValues("tenant", tenant.Name)
	namespace := fmt.Sprintf("tenant-%s", tenant.Name)
	services := &corev1.ServiceList{}
	if err := d.client.List(ctx, services, client.InNamespace(namespace)); err != nil {
		return fmt.Errorf("failed to list services: %w", err)
	}
	endpoints := []ServiceEndpoint{}
	for _, svc := range services.Items {
		if isSystemService(svc.Name) {
			continue
		}
		ep := &corev1.Endpoints{}
		if err := d.client.Get(ctx, types.NamespacedName{Name: svc.Name, Namespace: svc.Namespace}, ep); err != nil {
			if !errors.IsNotFound(err) {
				log.Error(err, "Failed to get endpoints", "service", svc.Name)
			}
			continue
		}
		for _, subset := range ep.Subsets {
			for _, addr := range subset.Addresses {
				for _, port := range subset.Ports {
					endpoint := ServiceEndpoint{
						Service:   svc.Name,
						Namespace: svc.Namespace,
						Tenant:    tenant.Name,
						Address:   addr.IP,
						Port:      port.Port,
						Protocol:  string(port.Protocol),
						Metadata: map[string]string{
							"tier":         tenant.Spec.Tier,
							"organization": tenant.Spec.OrganizationName,
						},
						Health: HealthStatus{
							Status:    "unknown",
							LastCheck: time.Now(),
						},
						UpdatedAt: time.Now(),
					}
					for k, v := range svc.Labels {
						endpoint.Metadata[k] = v
					}
					endpoints = append(endpoints, endpoint)
				}
			}
		}
	}
	d.cache.mu.Lock()
	d.cache.endpoints[tenant.Name] = endpoints
	d.cache.tenants[tenant.Name] = tenant.DeepCopy()
	d.cache.mu.Unlock()
	return d.updateDiscoveryConfigMap(ctx, tenant, endpoints)
}

// GetServiceEndpoints returns all endpoints for a service
func (d *Client) GetServiceEndpoints(service, tenant string) []ServiceEndpoint {
	d.cache.mu.RLock()
	defer d.cache.mu.RUnlock()
	var result []ServiceEndpoint
	for _, ep := range d.cache.endpoints[tenant] {
		if ep.Service == service {
			result = append(result, ep)
		}
	}
	return result
}

// GetTenantEndpoints returns all endpoints for a tenant
func (d *Client) GetTenantEndpoints(tenant string) []ServiceEndpoint {
	d.cache.mu.RLock()
	defer d.cache.mu.RUnlock()
	endpoints := d.cache.endpoints[tenant]
	result := make([]ServiceEndpoint, len(endpoints))
	copy(result, endpoints)
	return result
}

// GetAllEndpoints returns all registered endpoints
func (d *Client) GetAllEndpoints() map[string][]ServiceEndpoint {
	d.cache.mu.RLock()
	defer d.cache.mu.RUnlock()
	result := make(map[string][]ServiceEndpoint)
	for tenant, endpoints := range d.cache.endpoints {
		eps := make([]ServiceEndpoint, len(endpoints))
		copy(eps, endpoints)
		result[tenant] = eps
	}
	return result
}

// FindService locates a service endpoint by criteria
func (d *Client) FindService(criteria map[string]string) []ServiceEndpoint {
	d.cache.mu.RLock()
	defer d.cache.mu.RUnlock()
	var result []ServiceEndpoint
	for _, endpoints := range d.cache.endpoints {
		for _, ep := range endpoints {
			if matchesCriteria(ep, criteria) {
				result = append(result, ep)
			}
		}
	}
	return result
}

// RemoveTenant removes a tenant from service discovery
func (d *Client) RemoveTenant(ctx context.Context, tenant *tenantv1alpha1.Tenant) error {
	d.cache.mu.Lock()
	delete(d.cache.endpoints, tenant.Name)
	delete(d.cache.tenants, tenant.Name)
	d.cache.mu.Unlock()
	// Delete discovery ConfigMap
	cm := &corev1.ConfigMap{}
	err := d.client.Get(ctx, types.NamespacedName{Name: fmt.Sprintf("%s-discovery", tenant.Name), Namespace: "tenant-system"}, cm)
	if err == nil {
		return d.client.Delete(ctx, cm)
	}
	if errors.IsNotFound(err) {
		return nil
	}
	return err
}

// updateDiscoveryConfigMap updates the discovery data in a ConfigMap
func (d *Client) updateDiscoveryConfigMap(ctx context.Context, tenant *tenantv1alpha1.Tenant, endpoints []ServiceEndpoint) error {
	data, err := json.MarshalIndent(map[string]interface{}{
		"tenant":    tenant.Name,
		"endpoints": endpoints,
		"metadata": map[string]string{
			"tier":         tenant.Spec.Tier,
			"organization": tenant.Spec.OrganizationName,
			"updatedAt":    time.Now().Format(time.RFC3339),
		},
	}, "", "  ")
	if err != nil {
		return err
	}
	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%s-discovery", tenant.Name),
			Namespace: "tenant-system",
			Labels: map[string]string{
				"tenant.rezenkai.com/name":   tenant.Name,
				"app.kubernetes.io/component": "discovery",
			},
		},
		Data: map[string]string{
			"discovery.json": string(data),
		},
	}
	existingCM := &corev1.ConfigMap{}
	err = d.client.Get(ctx, types.NamespacedName{Name: cm.Name, Namespace: cm.Namespace}, existingCM)
	if err != nil {
		if errors.IsNotFound(err) {
			return d.client.Create(ctx, cm)
		}
		return err
	}
	existingCM.Data = cm.Data
	return d.client.Update(ctx, existingCM)
}

// CheckServiceHealth performs health check on a service endpoint
func (d *Client) CheckServiceHealth(ctx context.Context, endpoint ServiceEndpoint) HealthStatus {
	client := &http.Client{Timeout: 5 * time.Second}
	url := fmt.Sprintf("http://%s:%d/health", endpoint.Address, endpoint.Port)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return HealthStatus{
			Status:    "unhealthy",
			LastCheck: time.Now(),
			Message:   fmt.Sprintf("Failed to create request: %v", err),
		}
	}
	resp, err := client.Do(req)
	if err != nil {
		return HealthStatus{
			Status:    "unhealthy",
			LastCheck: time.Now(),
			Message:   fmt.Sprintf("Health check failed: %v", err),
		}
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return HealthStatus{
			Status:    "unhealthy",
			LastCheck: time.Now(),
			Message:   fmt.Sprintf("Health check returned status: %d", resp.StatusCode),
		}
	}
	return HealthStatus{
		Status:    "healthy",
		LastCheck: time.Now(),
		Message:   "Service is responding",
	}
}

// UpdateHealthStatus updates the health status of an endpoint
func (d *Client) UpdateHealthStatus(tenant, service string, health HealthStatus) {
	d.cache.mu.Lock()
	defer d.cache.mu.Unlock()
	for i, ep := range d.cache.endpoints[tenant] {
		if ep.Service == service {
			d.cache.endpoints[tenant][i].Health = health
			d.cache.endpoints[tenant][i].UpdatedAt = time.Now()
		}
	}
}

// ServiceWatcher reconciles Kubernetes Service objects
type ServiceWatcher struct {
	Discovery *Client
}

// Reconcile implements the reconciliation loop for Service objects
func (w *ServiceWatcher) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := log.FromContext(ctx).WithValues("service", req.NamespacedName)

	// Fetch the Service
	svc := &corev1.Service{}
	if err := w.Discovery.client.Get(ctx, req.NamespacedName, svc); err != nil {
		if errors.IsNotFound(err) {
			log.Info("Service not found, removing from discovery if exists")
			// Extract tenant name from namespace (tenant-<name>)
			if tenantName := extractTenantName(req.Namespace); tenantName != "" {
				w.Discovery.cache.mu.Lock()
				endpoints := w.Discovery.cache.endpoints[tenantName]
				var newEndpoints []ServiceEndpoint
				for _, ep := range endpoints {
					if ep.Service != req.Name {
						newEndpoints = append(newEndpoints, ep)
					}
				}
				w.Discovery.cache.endpoints[tenantName] = newEndpoints
				w.Discovery.cache.mu.Unlock()
				tenant := &tenantv1alpha1.Tenant{}
				if err := w.Discovery.client.Get(ctx, types.NamespacedName{Name: tenantName, Namespace: req.Namespace}, tenant); err == nil {
					w.Discovery.updateDiscoveryConfigMap(ctx, tenant, newEndpoints)
				}
			}
			return ctrl.Result{}, nil
		}
		log.Error(err, "Failed to get Service")
		return ctrl.Result{}, err
	}

	// Extract tenant name from namespace
	tenantName := extractTenantName(req.Namespace)
	if tenantName == "" {
		return ctrl.Result{}, nil // Not a tenant namespace
	}

	// Fetch tenant
	tenant := &tenantv1alpha1.Tenant{}
	if err := w.Discovery.client.Get(ctx, types.NamespacedName{Name: tenantName, Namespace: req.Namespace}, tenant); err != nil {
		log.Error(err, "Failed to get Tenant")
		return ctrl.Result{}, err
	}

	// Update service endpoints
	if err := w.Discovery.UpdateServiceEndpoints(ctx, tenant); err != nil {
		log.Error(err, "Failed to update service endpoints")
		return ctrl.Result{RequeueAfter: 30 * time.Second}, err
	}

	return ctrl.Result{}, nil
}

// SetupWithManager sets up the controller with the Manager
func (w *ServiceWatcher) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&corev1.Service{}).
		WithEventFilter(predicate.Funcs{
			CreateFunc: func(e ctrl.CreateEvent) bool {
				return isTenantNamespace(e.Object.GetNamespace())
			},
			UpdateFunc: func(e ctrl.UpdateEvent) bool {
				return isTenantNamespace(e.ObjectNew.GetNamespace())
			},
			DeleteFunc: func(e ctrl.DeleteEvent) bool {
				return isTenantNamespace(e.Object.GetNamespace())
			},
		}).
		Complete(w)
}

// Helper functions
func isSystemService(name string) bool {
	systemServices := []string{"kubernetes", "kube-dns", "metrics-server"}
	for _, svc := range systemServices {
		if name == svc {
			return true
		}
	}
	return false
}

func matchesCriteria(endpoint ServiceEndpoint, criteria map[string]string) bool {
	for key, value := range criteria {
		switch key {
		case "service":
			if endpoint.Service != value {
				return false
			}
		case "tenant":
			if endpoint.Tenant != value {
				return false
			}
		case "namespace":
			if endpoint.Namespace != value {
				return false
			}
		default:
			if endpoint.Metadata[key] != value {
				return false
			}
		}
	}
	return true
}

func isTenantNamespace(namespace string) bool {
	return len(namespace) > len("tenant-") && namespace[:len("tenant-")] == "tenant-"
}

func extractTenantName(namespace string) string {
	if isTenantNamespace(namespace) {
		return namespace[len("tenant-"):]
	}
	return ""
}

// Registry provides a central registry for service discovery
type Registry struct {
	mu        sync.RWMutex
	services  map[string]*ServiceInfo
}

// ServiceInfo contains detailed service information
type ServiceInfo struct {
	Name        string            `json:"name"`
	Version     string            `json:"version"`
	Endpoints   []ServiceEndpoint `json:"endpoints"`
	Metadata    map[string]string `json:"metadata"`
	LastUpdated time.Time         `json:"lastUpdated"`
}

// NewRegistry creates a new service registry
func NewRegistry() *Registry {
	return &Registry{
		services: make(map[string]*ServiceInfo),
	}
}

// Register adds or updates a service in the registry
func (r *Registry) Register(info *ServiceInfo) {
	r.mu.Lock()
	defer r.mu.Unlock()
	info.LastUpdated = time.Now()
	r.services[info.Name] = info
}

// Deregister removes a service from the registry
func (r *Registry) Deregister(name string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.services, name)
}

// Get retrieves service information
func (r *Registry) Get(name string) (*ServiceInfo, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	info, exists := r.services[name]
	return info, exists
}

// List returns all registered services
func (r *Registry) List() []*ServiceInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []*ServiceInfo
	for _, info := range r.services {
		result = append(result, info)
	}
	return result
}