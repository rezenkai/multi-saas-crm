package commands

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/docker/docker/client"
	tenantv1alpha1 "github.com/rezenkai/multi-saas-crm/tenant-orchestrator/api/v1alpha1"
	"github.com/rezenkai/multi-saas-crm/tenant-orchestrator/cli/internal/config"
	"github.com/rezenkai/multi-saas-crm/tenant-orchestrator/cli/internal/kube"
	"github.com/rezenkai/multi-saas-crm/tenant-orchestrator/cli/internal/utils"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/types"
)

// NewTenantCmd creates the tenant management command
func NewTenantCmd(cfg *config.Config) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "tenant",
		Short: "Manage tenants",
		Long:  "Commands for creating, updating, and managing multi-tenant deployments",
	}
	cmd.AddCommand(
		newTenantCreateCmd(cfg),
		newTenantListCmd(cfg),
		newTenantGetCmd(cfg),
		newTenantUpdateCmd(cfg),
		newTenantDeleteCmd(cfg),
		newTenantScaleCmd(cfg),
		newTenantUpgradeCmd(cfg),
	)
	return cmd
}

func newTenantCreateCmd(cfg *config.Config) *cobra.Command {
	var (
		file            string
		organization    string
		tier            string
		domains         []string
		services        []string
		databaseType    string
		databaseVersion string
		cpuRequest      string
		cpuLimit        string
		memoryRequest   string
		memoryLimit     string
		storageSize     string
		wait            bool
		output          string
	)
	cmd := &cobra.Command{
		Use:   "create [NAME]",
		Short: "Create a new tenant",
		Long:  "Create a new tenant with specified configuration",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()
			client, err := kube.NewClient(cfg)
			if err != nil {
				return fmt.Errorf("failed to create kubernetes client: %w", err)
			}
			var tenant *tenantv1alpha1.Tenant
			if file != "" {
				// Load from file
				data, err := os.ReadFile(file)
				if err != nil {
					return fmt.Errorf("failed to read file: %w", err)
				}
				tenant = &tenantv1alpha1.Tenant{}
				if strings.HasSuffix(file, ".yaml") || strings.HasSuffix(file, ".yml") {
					if err := yaml.Unmarshal(data, tenant); err != nil {
						return fmt.Errorf("failed to parse YAML: %w", err)
					}
				} else if strings.HasSuffix(file, ".json") {
					if err := json.Unmarshal(data, tenant); err != nil {
						return fmt.Errorf("failed to parse JSON: %w", err)
					}
				} else {
					return fmt.Errorf("unsupported file format (use .yaml or .json)")
				}
			} else {
				// Create from flags
				if len(args) == 0 {
					return fmt.Errorf("tenant name is required")
				}
				name := args[0]
				if !utils.IsValidName(name) {
					return fmt.Errorf("invalid tenant name: must be lowercase alphanumeric")
				}
				// Parse services
				var serviceSpecs []tenantv1alpha1.ServiceSpec
				for _, svc := range services {
					parts := strings.Split(svc, ":")
					if len(parts) != 3 {
						return fmt.Errorf("invalid service format: %s (expected name:version:replicas)", svc)
					}
					replicas, err := utils.ParseInt32(parts[2])
					if err != nil {
						return fmt.Errorf("invalid replicas for service %s: %w", parts[0], err)
					}
					serviceSpecs = append(serviceSpecs, tenantv1alpha1.ServiceSpec{
						Name:     parts[0],
						Version:  parts[1],
						Replicas: replicas,
						Env:      []corev1.EnvVar{},
					})
				}
				tenant = &tenantv1alpha1.Tenant{
					TypeMeta: metav1.TypeMeta{
						APIVersion: "tenant.rezenkai.com/v1alpha1",
						Kind:       "Tenant",
					},
					ObjectMeta: metav1.ObjectMeta{
						Name:      name,
						Namespace: cfg.Namespace,
					},
					Spec: tenantv1alpha1.TenantSpec{
						OrganizationName: organization,
						Tier:             tier,
						Domains:          domains,
						Services:         serviceSpecs,
						Resources: tenantv1alpha1.ResourceSpec{
							CPU: tenantv1alpha1.CPUSpec{
								Request: cpuRequest,
								Limit:   cpuLimit,
							},
							Memory: tenantv1alpha1.MemorySpec{
								Request: memoryRequest,
								Limit:   memoryLimit,
							},
							Storage: tenantv1alpha1.StorageSpec{
								Size: storageSize,
							},
						},
						Database: tenantv1alpha1.DatabaseSpec{
							Type:    databaseType,
							Version: databaseVersion,
							Backup:  tenantv1alpha1.BackupSpec{Enabled: true},
						},
					},
				}
			}
			// Create tenant
			if err := client.Create(ctx, tenant); err != nil {
				return fmt.Errorf("failed to create tenant: %w", err)
			}
			fmt.Printf("Tenant '%s' created successfully\n", tenant.Name)
			// Wait for tenant to be ready if requested
			if wait {
				fmt.Println("Waiting for tenant to be ready...")
				if err := waitForTenant(ctx, client, tenant.Name, tenant.Namespace); err != nil {
					return fmt.Errorf("error waiting for tenant: %w", err)
				}
				fmt.Println("Tenant is ready!")
			}
			// Output result
			return outputTenant(tenant, output)
		},
	}
	cmd.Flags().StringVarP(&file, "file", "f", "", "Path to tenant configuration file")
	cmd.Flags().StringVar(&organization, "org", "", "Organization name")
	cmd.Flags().StringVar(&tier, "tier", "standard", "Tenant tier (standard, premium)")
	cmd.Flags().StringSliceVar(&domains, "domains", []string{}, "Custom domains for the tenant")
	cmd.Flags().StringSliceVar(&services, "services", []string{}, "Services to deploy (format: name:version:replicas)")
	cmd.Flags().StringVar(&databaseType, "db-type", "postgres", "Database type (postgres, mysql)")
	cmd.Flags().StringVar(&databaseVersion, "db-version", "13", "Database version")
	cmd.Flags().StringVar(&cpuRequest, "cpu-request", "500m", "CPU request")
	cmd.Flags().StringVar(&cpuLimit, "cpu-limit", "1000m", "CPU limit")
	cmd.Flags().StringVar(&memoryRequest, "memory-request", "512Mi", "Memory request")
	cmd.Flags().StringVar(&memoryLimit, "memory-limit", "1Gi", "Memory limit")
	cmd.Flags().StringVar(&storageSize, "storage", "10Gi", "Storage size")
	cmd.Flags().BoolVar(&wait, "wait", false, "Wait for tenant to be ready")
	cmd.Flags().StringVarP(&output, "output", "o", "", "Output format (json, yaml)")
	return cmd
}

func newTenantListCmd(cfg *config.Config) *cobra.Command {
	var (
		allNamespaces bool
		output        string
		selector      string
	)
	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List tenants",
		Aliases: []string{"ls"},
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()
			client, err := kube.NewClient(cfg)
			if err != nil {
				return fmt.Errorf("failed to create kubernetes client: %w", err)
			}
			opts := []client.ListOption{}
			if !allNamespaces {
				opts = append(opts, client.InNamespace(cfg.Namespace))
			}
			if selector != "" {
				opts = append(opts, client.MatchingLabelsSelector{Selector: labels.SelectorFromSet(labels.Parse(selector))})
			}
			tenants := &tenantv1alpha1.TenantList{}
			if err := client.List(ctx, tenants, opts...); err != nil {
				return fmt.Errorf("failed to list tenants: %w", err)
			}
			if output == "json" || output == "yaml" {
				return outputObject(tenants, output)
			}
			// Table output
			w := tabwriter.NewWriter(os.Stdout, 0, 0, 3, ' ', 0)
			fmt.Fprintln(w, "NAME\tORGANIZATION\tTIER\tPHASE\tSERVICES\tAGE")
			for _, tenant := range tenants.Items {
				age := utils.FormatAge(tenant.CreationTimestamp.Time)
				services := fmt.Sprintf("%d", len(tenant.Spec.Services))
				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\n",
					tenant.Name,
					tenant.Spec.OrganizationName,
					tenant.Spec.Tier,
					tenant.Status.Phase,
					services,
					age,
				)
			}
			return w.Flush()
		},
	}
	cmd.Flags().BoolVarP(&allNamespaces, "all-namespaces", "A", false, "List tenants across all namespaces")
	cmd.Flags().StringVarP(&output, "output", "o", "", "Output format (json, yaml)")
	cmd.Flags().StringVarP(&selector, "selector", "l", "", "Label selector")
	return cmd
}

func newTenantGetCmd(cfg *config.Config) *cobra.Command {
	var output string
	cmd := &cobra.Command{
		Use:   "get NAME",
		Short: "Get tenant details",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()
			client, err := kube.NewClient(cfg)
			if err != nil {
				return fmt.Errorf("failed to create kubernetes client: %w", err)
			}
			tenant := &tenantv1alpha1.Tenant{}
			if err := client.Get(ctx, types.NamespacedName{
				Name:      args[0],
				Namespace: cfg.Namespace,
			}, tenant); err != nil {
				return fmt.Errorf("failed to get tenant: %w", err)
			}
			return outputTenant(tenant, output)
		},
	}
	cmd.Flags().StringVarP(&output, "output", "o", "", "Output format (json, yaml)")
	return cmd
}

func newTenantUpdateCmd(cfg *config.Config) *cobra.Command {
	var (
		file     string
		tier     string
		replicas map[string]int32
		wait     bool
	)
	cmd := &cobra.Command{
		Use:   "update NAME",
		Short: "Update tenant configuration",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()
			client, err := kube.NewClient(cfg)
			if err != nil {
				return fmt.Errorf("failed to create kubernetes client: %w", err)
			}
			name := args[0]
			// Get existing tenant
			tenant := &tenantv1alpha1.Tenant{}
			if err := client.Get(ctx, types.NamespacedName{
				Name:      name,
				Namespace: cfg.Namespace,
			}, tenant); err != nil {
				return fmt.Errorf("failed to get tenant: %w", err)
			}
			if file != "" {
				// Update from file
				data, err := os.ReadFile(file)
				if err != nil {
					return fmt.Errorf("failed to read file: %w", err)
				}
				updated := &tenantv1alpha1.Tenant{}
				if err := yaml.Unmarshal(data, updated); err != nil {
					return fmt.Errorf("failed to parse YAML: %w", err)
				}
				tenant.Spec = updated.Spec
			} else {
				// Update from flags
				if tier != "" {
					tenant.Spec.Tier = tier
				}
				// Update service replicas
				for svcName, count := range replicas {
					for i, svc := range tenant.Spec.Services {
						if svc.Name == svcName {
							tenant.Spec.Services[i].Replicas = count
							break
						}
					}
				}
			}
			// Update tenant
			if err := client.Update(ctx, tenant); err != nil {
				return fmt.Errorf("failed to update tenant: %w", err)
			}
			fmt.Printf("Tenant '%s' updated successfully\n", name)
			if wait {
				fmt.Println("Waiting for update to complete...")
				if err := waitForTenant(ctx, client, name, cfg.Namespace); err != nil {
					return fmt.Errorf("error waiting for tenant: %w", err)
				}
				fmt.Println("Update completed!")
			}
			return nil
		},
	}
	cmd.Flags().StringVarP(&file, "file", "f", "", "Path to updated tenant configuration")
	cmd.Flags().StringVar(&tier, "tier", "", "Update tenant tier")
	cmd.Flags().StringToInt32Var(&replicas, "replicas", map[string]int32{}, "Update service replicas (format: service=count)")
	cmd.Flags().BoolVar(&wait, "wait", false, "Wait for update to complete")
	return cmd
}

func newTenantDeleteCmd(cfg *config.Config) *cobra.Command {
	var (
		force bool
		wait  bool
	)
	cmd := &cobra.Command{
		Use:   "delete NAME",
		Short: "Delete a tenant",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()
			client, err := kube.NewClient(cfg)
			if err != nil {
				return fmt.Errorf("failed to create kubernetes client: %w", err)
			}
			name := args[0]
			if !force {
				// Confirmation prompt
				fmt.Printf("Are you sure you want to delete tenant '%s'? This action cannot be undone. [y/N]: ", name)
				var response string
				fmt.Scanln(&response)
				if strings.ToLower(response) != "y" {
					fmt.Println("Deletion cancelled")
					return nil
				}
			}
			// Delete tenant
			tenant := &tenantv1alpha1.Tenant{
				ObjectMeta: metav1.ObjectMeta{
					Name:      name,
					Namespace: cfg.Namespace,
				},
			}
			if err := client.Delete(ctx, tenant); err != nil {
				return fmt.Errorf("failed to delete tenant: %w", err)
			}
			fmt.Printf("Tenant '%s' deletion initiated\n", name)
			if wait {
				fmt.Println("Waiting for tenant deletion to complete...")
				if err := waitForDeletion(ctx, client, name, cfg.Namespace); err != nil {
					return fmt.Errorf("error waiting for deletion: %w", err)
				}
				fmt.Println("Tenant deleted successfully")
			}
			return nil
		},
	}
	cmd.Flags().BoolVar(&force, "force", false, "Skip confirmation prompt")
	cmd.Flags().BoolVar(&wait, "wait", false, "Wait for deletion to complete")
	return cmd
}

func newTenantScaleCmd(cfg *config.Config) *cobra.Command {
	var wait bool
	cmd := &cobra.Command{
		Use:   "scale NAME SERVICE=REPLICAS",
		Short: "Scale tenant services",
		Args:  cobra.MinimumNArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()
			client, err := kube.NewClient(cfg)
			if err != nil {
				return fmt.Errorf("failed to create kubernetes client: %w", err)
			}
			name := args[0]
			// Parse scale requests
			scaleRequests := make(map[string]int32)
			for _, arg := range args[1:] {
				parts := strings.Split(arg, "=")
				if len(parts) != 2 {
					return fmt.Errorf("invalid scale format: %s (expected SERVICE=REPLICAS)", arg)
				}
				replicas, err := utils.ParseInt32(parts[1])
				if err != nil {
					return fmt.Errorf("invalid replicas for %s: %w", parts[0], err)
				}
				scaleRequests[parts[0]] = replicas
			}
			// Get tenant
			tenant := &tenantv1alpha1.Tenant{}
			if err := client.Get(ctx, types.NamespacedName{
				Name:      name,
				Namespace: cfg.Namespace,
			}, tenant); err != nil {
				return fmt.Errorf("failed to get tenant: %w", err)
			}
			// Update service replicas
			updated := false
			for svcName, replicas := range scaleRequests {
				found := false
				for i, svc := range tenant.Spec.Services {
					if svc.Name == svcName {
						tenant.Spec.Services[i].Replicas = replicas
						found = true
						updated = true
						fmt.Printf("Scaling service '%s' to %d replicas\n", svcName, replicas)
						break
					}
				}
				if !found {
					return fmt.Errorf("service '%s' not found in tenant", svcName)
				}
			}
			if updated {
				if err := client.Update(ctx, tenant); err != nil {
					return fmt.Errorf("failed to update tenant: %w", err)
				}
				if wait {
					fmt.Println("Waiting for scale operation to complete...")
					if err := waitForServiceScale(ctx, client, tenant, scaleRequests); err != nil {
						return fmt.Errorf("error waiting for scale: %w", err)
					}
					fmt.Println("Scale operation completed successfully")
				}
			}
			return nil
		},
	}
	cmd.Flags().BoolVar(&wait, "wait", false, "Wait for scale operation to complete")
	return cmd
}

func newTenantUpgradeCmd(cfg *config.Config) *cobra.Command {
	var (
		service  string
		version  string
		all      bool
		wait     bool
		strategy string
	)
	cmd := &cobra.Command{
		Use:   "upgrade NAME",
		Short: "Upgrade tenant services",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()
			client, err := kube.NewClient(cfg)
			if err != nil {
				return fmt.Errorf("failed to create kubernetes client: %w", err)
			}
			name := args[0]
			// Get tenant
			tenant := &tenantv1alpha1.Tenant{}
			if err := client.Get(ctx, types.NamespacedName{
				Name:      name,
				Namespace: cfg.Namespace,
			}, tenant); err != nil {
				return fmt.Errorf("failed to get tenant: %w", err)
			}
			// Validate strategy
			if strategy != "rolling" && strategy != "recreate" {
				return fmt.Errorf("invalid strategy: %s (must be 'rolling' or 'recreate')", strategy)
			}
			// Update service versions
			updated := false
			if all {
				// Upgrade all services
				for i := range tenant.Spec.Services {
					tenant.Spec.Services[i].Version = version
					fmt.Printf("Upgrading service '%s' to version %s\n", tenant.Spec.Services[i].Name, version)
					updated = true
				}
			} else if service != "" {
				// Upgrade specific service
				found := false
				for i, svc := range tenant.Spec.Services {
					if svc.Name == service {
						tenant.Spec.Services[i].Version = version
						fmt.Printf("Upgrading service '%s' to version %s\n", service, version)
						found = true
						updated = true
						break
					}
				}
				if !found {
					return fmt.Errorf("service '%s' not found in tenant", service)
				}
			} else {
				return fmt.Errorf("either --service or --all must be specified")
			}
			if updated {
				// Add upgrade annotation
				if tenant.Annotations == nil {
					tenant.Annotations = make(map[string]string)
				}
				tenant.Annotations["tenant.rezenkai.com/upgrade-strategy"] = strategy
				tenant.Annotations["tenant.rezenkai.com/upgrade-timestamp"] = time.Now().Format(time.RFC3339)
				if err := client.Update(ctx, tenant); err != nil {
					return fmt.Errorf("failed to update tenant: %w", err)
				}
				if wait {
					fmt.Println("Waiting for upgrade to complete...")
					if err := waitForUpgrade(ctx, client, tenant); err != nil {
						return fmt.Errorf("error waiting for upgrade: %w", err)
					}
					fmt.Println("Upgrade completed successfully")
				}
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&service, "service", "", "Service to upgrade")
	cmd.Flags().StringVar(&version, "version", "", "Target version")
	cmd.Flags().BoolVar(&all, "all", false, "Upgrade all services")
	cmd.Flags().BoolVar(&wait, "wait", false, "Wait for upgrade to complete")
	cmd.Flags().StringVar(&strategy, "strategy", "rolling", "Upgrade strategy (rolling, recreate)")
	cmd.MarkFlagRequired("version")
	return cmd
}

// Helper functions
func outputTenant(tenant *tenantv1alpha1.Tenant, format string) error {
	switch format {
	case "json":
		data, err := json.MarshalIndent(tenant, "", "  ")
		if err != nil {
			return err
		}
		fmt.Println(string(data))
	case "yaml":
		data, err := yaml.Marshal(tenant)
		if err != nil {
			return err
		}
		fmt.Print(string(data))
	default:
		// Detailed output
		fmt.Printf("Name: %s\n", tenant.Name)
		fmt.Printf("Namespace: %s\n", tenant.Namespace)
		fmt.Printf("Organization: %s\n", tenant.Spec.OrganizationName)
		fmt.Printf("Tier: %s\n", tenant.Spec.Tier)
		fmt.Printf("Phase: %s\n", tenant.Status.Phase)
		if len(tenant.Spec.Domains) > 0 {
			fmt.Printf("Domains: %s\n", strings.Join(tenant.Spec.Domains, ", "))
		}
		if tenant.Status.URL != "" {
			fmt.Printf("URL: %s\n", tenant.Status.URL)
		}
		fmt.Println("\nServices:")
		for _, svc := range tenant.Spec.Services {
			status := "Not deployed"
			for _, s := range tenant.Status.Services {
				if s.Name == svc.Name {
					if s.Ready {
						status = "Ready"
					} else {
						status = "Not ready"
					}
					break
				}
			}
			fmt.Printf(" - %s (v%s): %d replicas - %s\n", svc.Name, svc.Version, svc.Replicas, status)
		}
		fmt.Println("\nDatabase:")
		fmt.Printf(" Type: %s %s\n", tenant.Spec.Database.Type, tenant.Spec.Database.Version)
		fmt.Printf(" Backup Enabled: %v\n", tenant.Spec.Database.Backup.Enabled)
		if tenant.Status.DatabaseStatus.ConnectionURL != "" {
			fmt.Printf(" URL: %s\n", tenant.Status.DatabaseStatus.ConnectionURL)
		}
		if tenant.Status.DatabaseStatus.LastBackupTime != nil {
			fmt.Printf(" Last Backup: %s\n", utils.FormatTime(tenant.Status.DatabaseStatus.LastBackupTime.Time))
		}
		if tenant.Status.DatabaseStatus.LastRestoreTime != nil {
			fmt.Printf(" Last Restore: %s\n", utils.FormatTime(tenant.Status.DatabaseStatus.LastRestoreTime.Time))
		}
		fmt.Println("\nResources:")
		fmt.Printf(" CPU: %s/%s (request/limit)\n", tenant.Spec.Resources.CPU.Request, tenant.Spec.Resources.CPU.Limit)
		fmt.Printf(" Memory: %s/%s (request/limit)\n", tenant.Spec.Resources.Memory.Request, tenant.Spec.Resources.Memory.Limit)
		fmt.Printf(" Storage: %s\n", tenant.Spec.Resources.Storage.Size)
		if len(tenant.Status.Conditions) > 0 {
			fmt.Println("\nConditions:")
			for _, cond := range tenant.Status.Conditions {
				fmt.Printf(" - %s: %s (%s)\n", cond.Type, cond.Status, cond.Message)
			}
		}
		if tenant.Status.LastReconciled != nil {
			fmt.Printf("\nLast Reconciled: %s\n", utils.FormatTime(tenant.Status.LastReconciled.Time))
		}
	}
	return nil
}

func outputObject(obj interface{}, format string) error {
	switch format {
	case "json":
		data, err := json.MarshalIndent(obj, "", "  ")
		if err != nil {
			return err
		}
		fmt.Println(string(data))
	case "yaml":
		data, err := yaml.Marshal(obj)
		if err != nil {
			return err
		}
		fmt.Print(string(data))
	default:
		return fmt.Errorf("unsupported output format: %s", format)
	}
	return nil
}

func waitForTenant(ctx context.Context, client client.Client, name, namespace string) error {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	timeout := time.After(10 * time.Minute)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timeout:
			return fmt.Errorf("timeout waiting for tenant to be ready")
		case <-ticker.C:
			tenant := &tenantv1alpha1.Tenant{}
			if err := client.Get(ctx, types.NamespacedName{
				Name:      name,
				Namespace: namespace,
			}, tenant); err != nil {
				return err
			}
			if tenant.Status.Phase == "Active" {
				return nil
			}
			if tenant.Status.Phase == "Failed" {
				return fmt.Errorf("tenant failed to provision")
			}
		}
	}
}

func waitForDeletion(ctx context.Context, client client.Client, name, namespace string) error {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	timeout := time.After(5 * time.Minute)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timeout:
			return fmt.Errorf("timeout waiting for deletion")
		case <-ticker.C:
			tenant := &tenantv1alpha1.Tenant{}
			err := client.Get(ctx, types.NamespacedName{
				Name:      name,
				Namespace: namespace,
			}, tenant)
			if kube.IsNotFound(err) {
				return nil
			}
			if err != nil {
				return err
			}
		}
	}
}

func waitForServiceScale(ctx context.Context, client client.Client, tenant *tenantv1alpha1.Tenant, expected map[string]int32) error {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	timeout := time.After(5 * time.Minute)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timeout:
			return fmt.Errorf("timeout waiting for scale operation")
		case <-ticker.C:
			// Refresh tenant status
			current := &tenantv1alpha1.Tenant{}
			if err := client.Get(ctx, types.NamespacedName{
				Name:      tenant.Name,
				Namespace: tenant.Namespace,
			}, current); err != nil {
				return err
			}
			// Check if all services are scaled
			allScaled := true
			for svcName, expectedReplicas := range expected {
				scaled := false
				for _, status := range current.Status.Services {
					if status.Name == svcName && status.Replicas == expectedReplicas && status.Ready {
						scaled = true
						break
					}
				}
				if !scaled {
					allScaled = false
					break
				}
			}
			if allScaled {
				return nil
			}
		}
	}
}

func waitForUpgrade(ctx context.Context, client client.Client, tenant *tenantv1alpha1.Tenant) error {
	// Simplified: reuse waitForTenant to check if tenant is Active
	return waitForTenant(ctx, client, tenant.Name, tenant.Namespace)
}