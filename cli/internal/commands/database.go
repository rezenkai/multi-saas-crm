package commands

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/mysql"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"
	"github.com/spf13/cobra"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/types"

	tenantv1alpha1 "github.com/rezenkai/multi-saas-crm/tenant-orchestrator/api/v1alpha1"
	"github.com/rezenkai/multi-saas-crm/tenant-orchestrator/cli/internal/config"
	"github.com/rezenkai/multi-saas-crm/tenant-orchestrator/cli/internal/kube"
	"github.com/rezenkai/multi-saas-crm/tenant-orchestrator/cli/internal/utils"
)

// NewDatabaseCmd creates the database management command
func NewDatabaseCmd(cfg *config.Config) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "database",
		Short: "Database management commands",
		Long:  "Commands for managing tenant databases including migrations, backups, and maintenance",
		Aliases: []string{"db"},
	}

	cmd.AddCommand(
		newDBMigrateCmd(cfg),
		newDBStatusCmd(cfg),
		newDBRollbackCmd(cfg),
		newDBSeedCmd(cfg),
		newDBConsoleCmd(cfg),
		newDBDumpCmd(cfg),
		newDBRestoreCmd(cfg),
	)

	return cmd
}

func newDBMigrateCmd(cfg *config.Config) *cobra.Command {
	var (
		tenant    string
		direction string
		steps     int
		version   int
		force     bool
	)

	cmd := &cobra.Command{
		Use:   "migrate",
		Short: "Run database migrations",
		Long:  "Apply pending database migrations for a tenant",
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()

			// Get database connection
			db, dbType, err := getDatabaseConnection(ctx, cfg, tenant)
			if err != nil {
				return fmt.Errorf("failed to connect to database: %w", err)
			}
			defer db.Close()

			// Initialize migrate driver
			var driver migrate.Driver
			switch dbType {
			case "postgres":
				driver, err = postgres.WithInstance(db, &postgres.Config{})
			case "mysql":
				driver, err = mysql.WithInstance(db, &mysql.Config{})
			default:
				return fmt.Errorf("unsupported database type: %s", dbType)
			}
			if err != nil {
				return fmt.Errorf("failed to create migration driver: %w", err)
			}

			// Get migrations path
			migrationsPath := filepath.Join("file://", getMigrationsDir(dbType))
			
			m, err := migrate.NewWithDatabaseInstance(migrationsPath, dbType, driver)
			if err != nil {
				return fmt.Errorf("failed to create migrator: %w", err)
			}
			defer m.Close()

			// Execute migration based on direction
			switch direction {
			case "up":
				if version > 0 {
					err = m.Migrate(uint(version))
				} else if steps > 0 {
					err = m.Steps(steps)
				} else {
					err = m.Up()
				}
			case "down":
				if steps > 0 {
					err = m.Steps(-steps)
				} else {
					err = m.Down()
				}
			default:
				return fmt.Errorf("invalid migration direction: %s", direction)
			}

			if err != nil && err != migrate.ErrNoChange {
				return fmt.Errorf("migration failed: %w", err)
			}

			if err == migrate.ErrNoChange {
				fmt.Println("No migrations to apply")
			} else {
				fmt.Printf("Successfully applied %s migrations for tenant '%s'\n", direction, tenant)
			}

			// Show current version
			currentVersion, _, err := m.Version()
			if err != nil && err != migrate.ErrNilVersion {
				return fmt.Errorf("failed to get current version: %w", err)
			}
			
			if err == migrate.ErrNilVersion {
				fmt.Println("Database is at initial state (no migrations applied)")
			} else {
				fmt.Printf("Current database version: %d\n", currentVersion)
			}

			return nil
		},
	}

	cmd.Flags().StringVarP(&tenant, "tenant", "t", "", "Tenant name (required)")
	cmd.Flags().StringVar(&direction, "direction", "up", "Migration direction (up/down)")
	cmd.Flags().IntVar(&steps, "steps", 0, "Number of migrations to apply")
	cmd.Flags().IntVar(&version, "version", 0, "Migrate to specific version")
	cmd.Flags().BoolVar(&force, "force", false, "Force migration (use with caution)")

	cmd.MarkFlagRequired("tenant")

	return cmd
}

func newDBStatusCmd(cfg *config.Config) *cobra.Command {
	var tenant string

	cmd := &cobra.Command{
		Use:   "status",
		Short: "Show database migration status",
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()

			// Get database connection
			db, dbType, err := getDatabaseConnection(ctx, cfg, tenant)
			if err != nil {
				return fmt.Errorf("failed to connect to database: %w", err)
			}
			defer db.Close()

			// Check connection
			if err := db.Ping(); err != nil {
				return fmt.Errorf("database ping failed: %w", err)
			}

			fmt.Printf("Database connection successful for tenant '%s'\n", tenant)
			fmt.Printf("Database type: %s\n\n", dbType)

			// Get migration status
			var driver migrate.Driver
			switch dbType {
			case "postgres":
				driver, err = postgres.WithInstance(db, &postgres.Config{})
			case "mysql":
				driver, err = mysql.WithInstance(db, &mysql.Config{})
			}
			if err != nil {
				return fmt.Errorf("failed to create migration driver: %w", err)
			}

			migrationsPath := filepath.Join("file://", getMigrationsDir(dbType))
			m, err := migrate.NewWithDatabaseInstance(migrationsPath, dbType, driver)
			if err != nil {
				return fmt.Errorf("failed to create migrator: %w", err)
			}
			defer m.Close()

			// Get current version
			version, dirty, err := m.Version()
			if err != nil && err != migrate.ErrNilVersion {
				return fmt.Errorf("failed to get migration version: %w", err)
			}

			if err == migrate.ErrNilVersion {
				fmt.Println("Migration Status: No migrations applied")
			} else {
				fmt.Printf("Migration Status:\n")
				fmt.Printf("  Current Version: %d\n", version)
				fmt.Printf("  Dirty:          %v\n", dirty)
			}

			// Show database statistics
			fmt.Println("\nDatabase Statistics:")
			stats := db.Stats()
			fmt.Printf("  Open Connections:    %d\n", stats.OpenConnections)
			fmt.Printf("  In Use:             %d\n", stats.InUse)
			fmt.Printf("  Idle:               %d\n", stats.Idle)
			fmt.Printf("  Max Open:           %d\n", stats.MaxOpenConnections)

			return nil
		},
	}

	cmd.Flags().StringVarP(&tenant, "tenant", "t", "", "Tenant name (required)")
	cmd.MarkFlagRequired("tenant")

	return cmd
}

func newDBRollbackCmd(cfg *config.Config) *cobra.Command {
	var (
		tenant string
		steps  int
		force  bool
	)

	cmd := &cobra.Command{
		Use:   "rollback",
		Short: "Rollback database migrations",
		RunE: func(cmd *cobra.Command, args []string) error {
			if !force {
				fmt.Printf("WARNING: This will rollback %d migration(s) for tenant '%s'. Continue? [y/N]: ", steps, tenant)
				var response string
				fmt.Scanln(&response)
				if strings.ToLower(response) != "y" {
					fmt.Println("Rollback cancelled")
					return nil
				}
			}

			// Reuse migrate command with down direction
			migrateCmd := newDBMigrateCmd(cfg)
			migrateCmd.SetArgs([]string{
				"--tenant", tenant,
				"--direction", "down",
				"--steps", fmt.Sprintf("%d", steps),
			})

			return migrateCmd.Execute()
		},
	}

	cmd.Flags().StringVarP(&tenant, "tenant", "t", "", "Tenant name (required)")
	cmd.Flags().IntVar(&steps, "steps", 1, "Number of migrations to rollback")
	cmd.Flags().BoolVar(&force, "force", false, "Skip confirmation")

	cmd.MarkFlagRequired("tenant")

	return cmd
}

func newDBSeedCmd(cfg *config.Config) *cobra.Command {
	var (
		tenant string
		file   string
		data   string
	)

	cmd := &cobra.Command{
		Use:   "seed",
		Short: "Seed database with initial data",
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()

			// Get database connection
			db, dbType, err := getDatabaseConnection(ctx, cfg, tenant)
			if err != nil {
				return fmt.Errorf("failed to connect to database: %w", err)
			}
			defer db.Close()

			// Load seed data
			var seedSQL string
			if file != "" {
				content, err := os.ReadFile(file)
				if err != nil {
					return fmt.Errorf("failed to read seed file: %w", err)
				}
				seedSQL = string(content)
			} else if data != "" {
				seedSQL = getSeedData(data, dbType)
			} else {
				return fmt.Errorf("either --file or --data must be specified")
			}

			// Execute seed data
			tx, err := db.Begin()
			if err != nil {
				return fmt.Errorf("failed to begin transaction: %w", err)
			}

			if _, err := tx.Exec(seedSQL); err != nil {
				tx.Rollback()
				return fmt.Errorf("failed to execute seed data: %w", err)
			}

			if err := tx.Commit(); err != nil {
				return fmt.Errorf("failed to commit transaction: %w", err)
			}

			fmt.Printf("Successfully seeded database for tenant '%s'\n", tenant)
			return nil
		},
	}

	cmd.Flags().StringVarP(&tenant, "tenant", "t", "", "Tenant name (required)")
	cmd.Flags().StringVarP(&file, "file", "f", "", "Path to seed file")
	cmd.Flags().StringVar(&data, "data", "", "Predefined seed data set (demo, test)")

	cmd.MarkFlagRequired("tenant")

	return cmd
}

func newDBConsoleCmd(cfg *config.Config) *cobra.Command {
	var tenant string

	cmd := &cobra.Command{
		Use:   "console",
		Short: "Open database console",
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()

			// Get database credentials
			creds, dbType, err := getDatabaseCredentials(ctx, cfg, tenant)
			if err != nil {
				return fmt.Errorf("failed to get database credentials: %w", err)
			}

			// Build connection command
			var consoleCmd []string
			switch dbType {
			case "postgres":
				consoleCmd = []string{
					"psql",
					"-h", creds.Host,
					"-p", fmt.Sprintf("%d", creds.Port),
					"-U", creds.Username,
					"-d", creds.Database,
				}
			case "mysql":
				consoleCmd = []string{
					"mysql",
					"-h", creds.Host,
					"-P", fmt.Sprintf("%d", creds.Port),
					"-u", creds.Username,
					fmt.Sprintf("-p%s", creds.Password),
					creds.Database,
				}
			default:
				return fmt.Errorf("unsupported database type: %s", dbType)
			}

			// Execute console command
			return utils.ExecuteCommand(consoleCmd[0], consoleCmd[1:]...)
		},
	}

	cmd.Flags().StringVarP(&tenant, "tenant", "t", "", "Tenant name (required)")
	cmd.MarkFlagRequired("tenant")

	return cmd
}

func newDBDumpCmd(cfg *config.Config) *cobra.Command {
	var (
		tenant string
		output string
		format string
	)

	cmd := &cobra.Command{
		Use:   "dump",
		Short: "Create database backup",
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()

			// Get database credentials
			creds, dbType, err := getDatabaseCredentials(ctx, cfg, tenant)
			if err != nil {
				return fmt.Errorf("failed to get database credentials: %w", err)
			}

			// Generate output filename if not specified
			if output == "" {
				timestamp := time.Now().Format("20060102-150405")
				output = fmt.Sprintf("%s-backup-%s.sql", tenant, timestamp)
			}

			// Build dump command
			var dumpCmd []string
			switch dbType {
			case "postgres":
				dumpCmd = []string{
					"pg_dump",
					"-h", creds.Host,
					"-p", fmt.Sprintf("%d", creds.Port),
					"-U", creds.Username,
					"-d", creds.Database,
					"-f", output,
				}
				if format == "custom" {
					dumpCmd = append(dumpCmd, "-Fc")
				}
			case "mysql":
				dumpCmd = []string{
					"mysqldump",
					"-h", creds.Host,
					"-P", fmt.Sprintf("%d", creds.Port),
					"-u", creds.Username,
					fmt.Sprintf("-p%s", creds.Password),
					"--result-file", output,
					creds.Database,
				}
			default:
				return fmt.Errorf("unsupported database type: %s", dbType)
			}

			fmt.Printf("Creating backup for tenant '%s'...\n", tenant)
			if err := utils.ExecuteCommand(dumpCmd[0], dumpCmd[1:]...); err != nil {
				return fmt.Errorf("backup failed: %w", err)
			}

			fileInfo, err := os.Stat(output)
			if err != nil {
				return fmt.Errorf("failed to stat backup file: %w", err)
			}

			fmt.Printf("Backup completed successfully!\n")
			fmt.Printf("File: %s\n", output)
			fmt.Printf("Size: %s\n", utils.FormatBytes(fileInfo.Size()))

			return nil
		},
	}

	cmd.Flags().StringVarP(&tenant, "tenant", "t", "", "Tenant name (required)")
	cmd.Flags().StringVarP(&output, "output", "o", "", "Output file path")
	cmd.Flags().StringVar(&format, "format", "plain", "Backup format (plain, custom)")

	cmd.MarkFlagRequired("tenant")

	return cmd
}

func newDBRestoreCmd(cfg *config.Config) *cobra.Command {
	var (
		tenant string
		input  string
		force  bool
	)

	cmd := &cobra.Command{
		Use:   "restore",
		Short: "Restore database from backup",
		RunE: func(cmd *cobra.Command, args []string) error {
			if !force {
				fmt.Printf("WARNING: This will restore database for tenant '%s' from backup. All current data will be lost. Continue? [y/N]: ", tenant)
				var response string
				fmt.Scanln(&response)
				if strings.ToLower(response) != "y" {
					fmt.Println("Restore cancelled")
					return nil
				}
			}

			ctx := context.Background()

			// Check if backup file exists
			if _, err := os.Stat(input); err != nil {
				return fmt.Errorf("backup file not found: %w", err)
			}

			// Get database credentials
			creds, dbType, err := getDatabaseCredentials(ctx, cfg, tenant)
			if err != nil {
				return fmt.Errorf("failed to get database credentials: %w", err)
			}

			// Build restore command
			var restoreCmd []string
			switch dbType {
			case "postgres":
				// Check if it's a custom format backup
				isCustomFormat := false
				// Simple check - could be improved
				if strings.HasSuffix(input, ".dump") {
					isCustomFormat = true
				}

				if isCustomFormat {
					restoreCmd = []string{
						"pg_restore",
						"-h", creds.Host,
						"-p", fmt.Sprintf("%d", creds.Port),
						"-U", creds.Username,
						"-d", creds.Database,
						"-c", // Clean database before restore
						input,
					}
				} else {
					restoreCmd = []string{
						"psql",
						"-h", creds.Host,
						"-p", fmt.Sprintf("%d", creds.Port),
						"-U", creds.Username,
						"-d", creds.Database,
						"-f", input,
					}
				}
			case "mysql":
				restoreCmd = []string{
					"mysql",
					"-h", creds.Host,
					"-P", fmt.Sprintf("%d", creds.Port),
					"-u", creds.Username,
					fmt.Sprintf("-p%s", creds.Password),
					creds.Database,
				}
				// For MySQL, we need to pipe the file
				// This would be handled differently in ExecuteCommand
			default:
				return fmt.Errorf("unsupported database type: %s", dbType)
			}

			fmt.Printf("Restoring database for tenant '%s'...\n", tenant)
			if err := utils.ExecuteCommand(restoreCmd[0], restoreCmd[1:]...); err != nil {
				return fmt.Errorf("restore failed: %w", err)
			}

			fmt.Println("Database restored successfully!")
			return nil
		},
	}

	cmd.Flags().StringVarP(&tenant, "tenant", "t", "", "Tenant name (required)")
	cmd.Flags().StringVarP(&input, "input", "i", "", "Backup file path (required)")
	cmd.Flags().BoolVar(&force, "force", false, "Skip confirmation")

	cmd.MarkFlagRequired("tenant")
	cmd.MarkFlagRequired("input")

	return cmd
}

// Helper functions

type DatabaseCredentials struct {
	Host     string
	Port     int
	Username string
	Password string
	Database string
}

func getDatabaseConnection(ctx context.Context, cfg *config.Config, tenant string) (*sql.DB, string, error) {
	creds, dbType, err := getDatabaseCredentials(ctx, cfg, tenant)
	if err != nil {
		return nil, "", err
	}

	var dsn string
	switch dbType {
	case "postgres":
		dsn = fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
			creds.Host, creds.Port, creds.Username, creds.Password, creds.Database)
	case "mysql":
		dsn = fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?parseTime=true",
			creds.Username, creds.Password, creds.Host, creds.Port, creds.Database)
	default:
		return nil, "", fmt.Errorf("unsupported database type: %s", dbType)
	}

	db, err := sql.Open(dbType, dsn)
	if err != nil {
		return nil, "", err
	}

	// Test connection
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, "", err
	}

	return db, dbType, nil
}

func getDatabaseCredentials(ctx context.Context, cfg *config.Config, tenantName string) (*DatabaseCredentials, string, error) {
	client, err := kube.NewClient(cfg)
	if err != nil {
		return nil, "", err
	}

	// Get tenant to determine database type
	tenant := &tenantv1alpha1.Tenant{}
	if err := client.Get(ctx, types.NamespacedName{
		Name:      tenantName,
		Namespace: cfg.Namespace,
	}, tenant); err != nil {
		return nil, "", fmt.Errorf("failed to get tenant: %w", err)
	}

	// Get database secret
	secret := &corev1.Secret{}
	if err := client.Get(ctx, types.NamespacedName{
		Name:      fmt.Sprintf("%s-db-credentials", tenantName),
		Namespace: fmt.Sprintf("tenant-%s", tenantName),
	}, secret); err != nil {
		return nil, "", fmt.Errorf("failed to get database credentials: %w", err)
	}

	// Parse credentials
	creds := &DatabaseCredentials{
		Host:     fmt.Sprintf("%s-db-svc.tenant-%s.svc.cluster.local", tenantName, tenantName),
		Port:     5432, // Default for PostgreSQL
		Username: string(secret.Data["username"]),
		Password: string(secret.Data["password"]),
		Database: string(secret.Data["database"]),
	}

	if tenant.Spec.Database.Type == "mysql" {
		creds.Port = 3306
	}

	// Check if we need to use port forwarding
	if cfg.UsePortForward {
		// Set up port forwarding
		localPort, err := setupPortForward(ctx, cfg, tenantName, tenant.Spec.Database.Type)
		if err != nil {
			return nil, "", fmt.Errorf("failed to setup port forwarding: %w", err)
		}
		creds.Host = "localhost"
		creds.Port = localPort
	}

	return creds, tenant.Spec.Database.Type, nil
}

func setupPortForward(ctx context.Context, cfg *config.Config, tenant, dbType string) (int, error) {
	// Implementation of kubectl port-forward
	// This is a simplified version - real implementation would use k8s client-go port forwarding
	localPort := 5432
	if dbType == "mysql" {
		localPort = 3306
	}
	
	// In a real implementation, this would:
	// 1. Find an available local port
	// 2. Set up port forwarding to the database pod
	// 3. Return the local port number
	
	return localPort, nil
}

func getMigrationsDir(dbType string) string {
	// Return the path to migrations based on database type
	baseDir := os.Getenv("MIGRATIONS_DIR")
	if baseDir == "" {
		baseDir = "./migrations"
	}
	return filepath.Join(baseDir, dbType)
}

func getSeedData(dataSet, dbType string) string {
	// Return predefined seed data based on the data set
	switch dataSet {
	case "demo":
		if dbType == "postgres" {
			return `
-- Demo seed data for PostgreSQL
INSERT INTO organizations (name, tier, created_at) VALUES 
  ('Acme Corp', 'enterprise', NOW()),
  ('TechStart Inc', 'starter', NOW());

INSERT INTO users (email, name, organization_id, created_at) VALUES
  ('admin@acme.com', 'Admin User', 1, NOW()),
  ('user@techstart.com', 'Regular User', 2, NOW());

INSERT INTO projects (name, organization_id, created_at) VALUES
  ('Project Alpha', 1, NOW()),
  ('Project Beta', 1, NOW()),
  ('Startup MVP', 2, NOW());
`
		} else if dbType == "mysql" {
			return `
-- Demo seed data for MySQL
INSERT INTO organizations (name, tier, created_at) VALUES 
  ('Acme Corp', 'enterprise', NOW()),
  ('TechStart Inc', 'starter', NOW());

INSERT INTO users (email, name, organization_id, created_at) VALUES
  ('admin@acme.com', 'Admin User', 1, NOW()),
  ('user@techstart.com', 'Regular User', 2, NOW());

INSERT INTO projects (name, organization_id, created_at) VALUES
  ('Project Alpha', 1, NOW()),
  ('Project Beta', 1, NOW()),
  ('Startup MVP', 2, NOW());
`
		}
	case "test":
		// Minimal test data
		return `-- Test seed data
INSERT INTO test_table (id, name) VALUES (1, 'test');`
	}
	return ""
}