package config

import (
	"os"

	"k8s.io/client-go/tools/clientcmd"
)

// Config holds CLI configuration
type Config struct {
    KubeConfig string
    Context    string
    Namespace  string
    Verbose    bool
}

// New creates a new Config instance
func New() *Config {
    return &Config{
        Namespace: "tenant-system",
    }
}

// Load loads the configuration from flags and environment
func (c *Config) Load() error {
    if c.KubeConfig == "" {
        home, err := os.UserHomeDir()
        if err != nil {
            return err
        }
        c.KubeConfig = home + "/.kube/config"
    }
    if _, err := os.Stat(c.KubeConfig); os.IsNotExist(err) {
        return nil // Kubeconfig is optional; will use in-cluster config if available
    }
    _, err := clientcmd.NewDefaultClientConfigLoadingRules().Load() // Ignore ClientConfig
    return err
}