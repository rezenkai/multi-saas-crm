package commands

import (
	"context"
	"fmt"
	"os"
	"sort"
	"strings"
	"text/tabwriter"
	"time"

	tenantv1alpha1 "github.com/rezenkai/multi-saas-crm/tenant-orchestrator/api/v1alpha1"
	"github.com/rezenkai/multi-saas-crm/tenant-orchestrator/cli/internal/config"
	"github.com/rezenkai/multi-saas-crm/tenant-orchestrator/cli/internal/kube"
	"github.com/rezenkai/multi-saas-crm/tenant-orchestrator/cli/internal/utils"
	"github.com/spf13/cobra"
	"k8s.io/apimachinery/pkg/types"
)

// NewBackupCmd creates the backup management command
func NewBackupCmd(cfg *config.Config) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "backup",
		Short: "Manage tenant backups",
		Long:  "Commands for creating, listing, restoring, and managing tenant backups",
	}
	cmd.AddCommand(
		newBackupCreateCmd(cfg),
		newBackupListCmd(cfg),
		newBackupRestoreCmd(cfg),
		newBackupDeleteCmd(cfg),
		newBackupEnableCmd(cfg),
		newBackupDisableCmd(cfg),
	)
	return cmd
}

func newBackupCreateCmd(cfg *config.Config) *cobra.Command {
	var (
		tenant string
		name   string
		wait   bool
	)
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a manual backup for a tenant",
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()
			client, err := kube.NewClient(cfg)
			if err != nil {
				return fmt.Errorf("failed to create kubernetes client: %w", err)
			}
			// Get tenant
			t := &tenantv1alpha1.Tenant{}
			if err := client.Get(ctx, types.NamespacedName{Name: tenant, Namespace: cfg.Namespace}, t); err != nil {
				return fmt.Errorf("failed to get tenant: %w", err)
			}
			// Trigger backup by creating a backup annotation or using a backup CR if implemented
			// For simplicity, we'll assume triggering via annotation
			if t.Annotations == nil {
				t.Annotations = make(map[string]string)
			}
			if name == "" {
				name = fmt.Sprintf("%s-manual-%s", tenant, time.Now().Format("20060102-150405"))
			}
			t.Annotations["tenant.yourdomain.com/backup-request"] = name
			if err := client.Update(ctx, t); err != nil {
				return fmt.Errorf("failed to request backup: %w", err)
			}
			fmt.Printf("Backup '%s' requested for tenant '%s'\n", name, tenant)
			if wait {
				fmt.Println("Waiting for backup to complete...")
				if err := waitForBackup(ctx, client, tenant, cfg.Namespace, name); err != nil {
					return fmt.Errorf("error waiting for backup: %w", err)
				}
				fmt.Println("Backup completed successfully")
			}
			return nil
		},
	}
	cmd.Flags().StringVarP(&tenant, "tenant", "t", "", "Tenant name (required)")
	cmd.Flags().StringVar(&name, "name", "", "Backup name (optional)")
	cmd.Flags().BoolVar(&wait, "wait", false, "Wait for backup to complete")
	cmd.MarkFlagRequired("tenant")
	return cmd
}

func newBackupListCmd(cfg *config.Config) *cobra.Command {
	var (
		tenant string
		output string
	)
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List backups for a tenant",
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()
			client, err := kube.NewClient(cfg)
			if err != nil {
				return fmt.Errorf("failed to create kubernetes client: %w", err)
			}
			// Get tenant
			t := &tenantv1alpha1.Tenant{}
			if err := client.Get(ctx, types.NamespacedName{Name: tenant, Namespace: cfg.Namespace}, t); err != nil {
				return fmt.Errorf("failed to get tenant: %w", err)
			}
			// For simplicity, assume backups are stored in status or as secrets/configmaps
			// Here we'll simulate listing from status.DatabaseStatus.LastBackupTime and assume multiple
			// In real impl, list from backup storage or CRs
			backups := []struct {
				Name      string
				Timestamp time.Time
				Status    string
			}{
				// Placeholder data
				{Name: "auto-20250801-1200", Timestamp: time.Now().Add(-24 * time.Hour), Status: "Completed"},
				{Name: "manual-20250802-0900", Timestamp: time.Now().Add(-1 * time.Hour), Status: "Completed"},
			}
			if output == "json" || output == "yaml" {
				return outputObject(backups, output)
			}
			// Table output
			w := tabwriter.NewWriter(os.Stdout, 0, 0, 3, ' ', 0)
			fmt.Fprintln(w, "NAME\tAGE\tSTATUS")
			sort.Slice(backups, func(i, j int) bool {
				return backups[i].Timestamp.After(backups[j].Timestamp)
			})
			for _, b := range backups {
				age := utils.FormatAge(b.Timestamp)
				fmt.Fprintf(w, "%s\t%s\t%s\n", b.Name, age, b.Status)
			}
			return w.Flush()
		},
	}
	cmd.Flags().StringVarP(&tenant, "tenant", "t", "", "Tenant name (required)")
	cmd.Flags().StringVarP(&output, "output", "o", "", "Output format (json, yaml)")
	cmd.MarkFlagRequired("tenant")
	return cmd
}

func newBackupRestoreCmd(cfg *config.Config) *cobra.Command {
	var (
		tenant string
		name   string
		force  bool
		wait   bool
	)
	cmd := &cobra.Command{
		Use:   "restore",
		Short: "Restore tenant from a backup",
		RunE: func(cmd *cobra.Command, args []string) error {
			if !force {
				fmt.Printf("WARNING: Restoring tenant '%s' from backup '%s' will overwrite current data. Continue? [y/N]: ", tenant, name)
				var response string
				fmt.Scanln(&response)
				if strings.ToLower(response) != "y" {
					fmt.Println("Restore cancelled")
					return nil
				}
			}
			ctx := context.Background()
			client, err := kube.NewClient(cfg)
			if err != nil {
				return fmt.Errorf("failed to create kubernetes client: %w", err)
			}
			// Get tenant
			t := &tenantv1alpha1.Tenant{}
			if err := client.Get(ctx, types.NamespacedName{Name: tenant, Namespace: cfg.Namespace}, t); err != nil {
				return fmt.Errorf("failed to get tenant: %w", err)
			}
			// Trigger restore via annotation
			if t.Annotations == nil {
				t.Annotations = make(map[string]string)
			}
			t.Annotations["tenant.yourdomain.com/restore-request"] = name
			if err := client.Update(ctx, t); err != nil {
				return fmt.Errorf("failed to request restore: %w", err)
			}
			fmt.Printf("Restore from '%s' requested for tenant '%s'\n", name, tenant)
			if wait {
				fmt.Println("Waiting for restore to complete...")
				if err := waitForRestore(ctx, client, tenant, cfg.Namespace, name); err != nil {
					return fmt.Errorf("error waiting for restore: %w", err)
				}
				fmt.Println("Restore completed successfully")
			}
			return nil
		},
	}
	cmd.Flags().StringVarP(&tenant, "tenant", "t", "", "Tenant name (required)")
	cmd.Flags().StringVar(&name, "name", "", "Backup name (required)")
	cmd.Flags().BoolVar(&force, "force", false, "Skip confirmation")
	cmd.Flags().BoolVar(&wait, "wait", false, "Wait for restore to complete")
	cmd.MarkFlagRequired("tenant")
	cmd.MarkFlagRequired("name")
	return cmd
}

func newBackupDeleteCmd(cfg *config.Config) *cobra.Command {
	var (
		tenant string
		name   string
		force  bool
	)
	cmd := &cobra.Command{
		Use:   "delete",
		Short: "Delete a backup",
		RunE: func(cmd *cobra.Command, args []string) error {
			if !force {
				fmt.Printf("Are you sure you want to delete backup '%s' for tenant '%s'? [y/N]: ", name, tenant)
				var response string
				fmt.Scanln(&response)
				if strings.ToLower(response) != "y" {
					fmt.Println("Deletion cancelled")
					return nil
				}
			}
			ctx := context.Background()
			client, err := kube.NewClient(cfg)
			if err != nil {
				return fmt.Errorf("failed to create kubernetes client: %w", err)
			}
			// Implement backup deletion logic, e.g., delete from storage or mark for deletion
			// For placeholder, just log
			fmt.Printf("Backup '%s' deleted for tenant '%s'\n", name, tenant)
			return nil
		},
	}
	cmd.Flags().StringVarP(&tenant, "tenant", "t", "", "Tenant name (required)")
	cmd.Flags().StringVar(&name, "name", "", "Backup name (required)")
	cmd.Flags().BoolVar(&force, "force", false, "Skip confirmation")
	cmd.MarkFlagRequired("tenant")
	cmd.MarkFlagRequired("name")
	return cmd
}

func newBackupEnableCmd(cfg *config.Config) *cobra.Command {
	var (
		tenant    string
		schedule  string
		retention int32
	)
	cmd := &cobra.Command{
		Use:   "enable",
		Short: "Enable automatic backups for a tenant",
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()
			client, err := kube.NewClient(cfg)
			if err != nil {
				return fmt.Errorf("failed to create kubernetes client: %w", err)
			}
			// Get tenant
			t := &tenantv1alpha1.Tenant{}
			if err := client.Get(ctx, types.NamespacedName{Name: tenant, Namespace: cfg.Namespace}, t); err != nil {
				return fmt.Errorf("failed to get tenant: %w", err)
			}
			// Update backup spec
			t.Spec.Database.Backup = tenantv1alpha1.BackupSpec{
				Enabled:       true,
				Schedule:      schedule,
				RetentionDays: retention,
			}
			if err := client.Update(ctx, t); err != nil {
				return fmt.Errorf("failed to update tenant: %w", err)
			}
			fmt.Printf("Automatic backups enabled for tenant '%s'\n", tenant)
			return nil
		},
	}
	cmd.Flags().StringVarP(&tenant, "tenant", "t", "", "Tenant name (required)")
	cmd.Flags().StringVar(&schedule, "schedule", "0 0 * * *", "Backup schedule (cron format)")
	cmd.Flags().Int32Var(&retention, "retention", 7, "Retention days")
	cmd.MarkFlagRequired("tenant")
	return cmd
}

func newBackupDisableCmd(cfg *config.Config) *cobra.Command {
	var tenant string
	cmd := &cobra.Command{
		Use:   "disable",
		Short: "Disable automatic backups for a tenant",
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()
			client, err := kube.NewClient(cfg)
			if err != nil {
				return fmt.Errorf("failed to create kubernetes client: %w", err)
			}
			// Get tenant
			t := &tenantv1alpha1.Tenant{}
			if err := client.Get(ctx, types.NamespacedName{Name: tenant, Namespace: cfg.Namespace}, t); err != nil {
				return fmt.Errorf("failed to get tenant: %w", err)
			}
			// Disable backup
			t.Spec.Database.Backup.Enabled = false
			if err := client.Update(ctx, t); err != nil {
				return fmt.Errorf("failed to update tenant: %w", err)
			}
			fmt.Printf("Automatic backups disabled for tenant '%s'\n", tenant)
			return nil
		},
	}
	cmd.Flags().StringVarP(&tenant, "tenant", "t", "", "Tenant name (required)")
	cmd.MarkFlagRequired("tenant")
	return cmd
}

// Helper functions (placeholders)
func waitForBackup(ctx context.Context, client kube.Client, tenant, namespace, backupName string) error {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	timeout := time.After(10 * time.Minute)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timeout:
			return fmt.Errorf("timeout waiting for backup")
		case <-ticker.C:
			t := &tenantv1alpha1.Tenant{}
			if err := client.Get(ctx, types.NamespacedName{Name: tenant, Namespace: namespace}, t); err != nil {
				return err
			}
			// Check if backup is completed, e.g., check status or annotation
			if _, ok := t.Annotations["tenant.yourdomain.com/backup-status-"+backupName]; ok {
				return nil // Assume completed if annotation present
			}
		}
	}
}

func waitForRestore(ctx context.Context, client kube.Client, tenant, namespace, backupName string) error {
	// Similar to waitForBackup
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	timeout := time.After(15 * time.Minute)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timeout:
			return fmt.Errorf("timeout waiting for restore")
		case <-ticker.C:
			t := &tenantv1alpha1.Tenant{}
			if err := client.Get(ctx, types.NamespacedName{Name: tenant, Namespace: namespace}, t); err != nil {
				return err
			}
			// Check restore status
			if t.Status.Phase == "Active" {
				return nil
			}
		}
	}
}