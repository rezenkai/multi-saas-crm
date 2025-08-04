package health

import (
	"context"
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	tenantv1alpha1 "github.com/rezenkai/multi-saas-crm/tenant-orchestrator/api/v1alpha1"
	"github.com/rezenkai/multi-saas-crm/tenant-orchestrator/pkg/discovery"
	appsv1 "k8s.io/api/apps/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"
)

var (
	tenantHealth = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "tenant_health_status",
			Help: "Health status of tenant services (1 = healthy, 0 = unhealthy)",
		},
		[]string{"tenant", "service"},
	)
)

// Monitor manages tenant health checks
type Monitor struct {
	client   client.Client
	discovery *discovery.Client
}

// NewMonitor creates a new health monitor
func NewMonitor(c client.Client, d *discovery.Client) *Monitor {
	return &Monitor{
		client:   c,
		discovery: d,
	}
}

// CheckTenantHealth checks the health of all services for a tenant
func (m *Monitor) CheckTenantHealth(ctx context.Context, tenant *tenantv1alpha1.Tenant) (bool, error) {
	log := log.FromContext(ctx).WithValues("tenant", tenant.Name)
	overallHealthy := true

	// Check service health using discovery client
	endpoints := m.discovery.GetTenantEndpoints(tenant.Name)
	for _, ep := range endpoints {
		healthStatus := m.discovery.CheckServiceHealth(ctx, ep)
		tenantHealth.WithLabelValues(tenant.Name, ep.Service).Set(boolToFloat64(healthStatus.Status == "healthy"))
		if healthStatus.Status != "healthy" {
			overallHealthy = false
			log.Info("Service unhealthy", "service", ep.Service, "message", healthStatus.Message)
		}
		m.discovery.UpdateHealthStatus(tenant.Name, ep.Service, healthStatus)
	}

	// Check database health
	dbHealthy, err := m.checkDatabaseHealth(ctx, tenant)
	if err != nil {
		log.Error(err, "Failed to check database health")
		overallHealthy = false
	}
	tenantHealth.WithLabelValues(tenant.Name, "database").Set(boolToFloat64(dbHealthy))

	return overallHealthy, nil
}

// checkDatabaseHealth performs a health check on the tenant's database
func (m *Monitor) checkDatabaseHealth(ctx context.Context, tenant *tenantv1alpha1.Tenant) (bool, error) {
	log := log.FromContext(ctx).WithValues("tenant", tenant.Name)
	statefulSet := &appsv1.StatefulSet{}
	err := m.client.Get(ctx, types.NamespacedName{
		Name:      fmt.Sprintf("%s-db", tenant.Name),
		Namespace: fmt.Sprintf("tenant-%s", tenant.Name),
	}, statefulSet)
	if err != nil {
		return false, fmt.Errorf("failed to get database StatefulSet: %w", err)
	}
	if statefulSet.Status.ReadyReplicas == 0 {
		return false, fmt.Errorf("database StatefulSet has no ready replicas")
	}

	// Optional: Add a database connectivity check (e.g., using a simple query)
	// This requires database credentials and a client (e.g., lib/pq for PostgreSQL)
	return true, nil
}

// boolToFloat64 converts a boolean to a Prometheus-compatible float64
func boolToFloat64(b bool) float64 {
	if b {
		return 1.0
	}
	return 0.0
}