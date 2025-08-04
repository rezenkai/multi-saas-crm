package kube

import (
	"fmt"

	tenantv1alpha1 "github.com/rezenkai/multi-saas-crm/tenant-orchestrator/api/v1alpha1"
	"github.com/rezenkai/multi-saas-crm/tenant-orchestrator/cli/internal/config"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

// Client wraps the controller-runtime client
type Client client.Client

// ListOption defines options for listing resources
type ListOption client.ListOption

// NewClient creates a new Kubernetes client
func NewClient(cfg *config.Config) (client.Client, error) {
	var config *rest.Config
	var err error
	if cfg.KubeConfig != "" {
		config, err = clientcmd.BuildConfigFromFlags(cfg.Context, cfg.KubeConfig)
	} else {
		config, err = rest.InClusterConfig()
	}
	if err != nil {
		return nil, fmt.Errorf("failed to build config: %w", err)
	}
	return client.New(config, client.Options{Scheme: tenantv1alpha1.Scheme})
}

// IsNotFound checks if an error is a NotFound error
func IsNotFound(err error) bool {
	return errors.IsNotFound(err)
}