package main

import (
	"fmt"
	"os"

	"github.com/rezenkai/multi-saas-crm/tenant-orchestrator/cli/internal/commands"
	"github.com/rezenkai/multi-saas-crm/tenant-orchestrator/cli/internal/config"
	"github.com/spf13/cobra"
)

var (
	version = "0.1.0" // Set during build with -ldflags
	commit  = "none"
	date    = "unknown"
)

func main() {
	cfg := config.New()
	rootCmd := &cobra.Command{
		Use:   "tenantctl",
		Short: "CLI for managing tenants in Multi-SaaS CRM",
		Long: `A CLI tool for managing multi-tenant SaaS CRM infrastructure.
This tool provides commands for creating and managing tenants, triggering backups and restores,
and monitoring tenant health in a Kubernetes-based environment.`,
		PersistentPreRun: func(cmd *cobra.Command, args []string) {
			if err := cfg.Load(); err != nil {
				fmt.Fprintf(os.Stderr, "Error loading config: %v\n", err)
				os.Exit(1)
			}
		},
	}

	// Global flags
	rootCmd.PersistentFlags().StringVar(&cfg.KubeConfig, "kubeconfig", "", "Path to kubeconfig file")
	rootCmd.PersistentFlags().StringVar(&cfg.Context, "context", "", "Kubernetes context to use")
	rootCmd.PersistentFlags().StringVar(&cfg.Namespace, "namespace", "tenant-system", "Default namespace")
	rootCmd.PersistentFlags().BoolVarP(&cfg.Verbose, "verbose", "v", false, "Enable verbose output")

	// Add commands
	rootCmd.AddCommand(
		commands.NewTenantCmd(cfg),
		commands.NewBackupCmd(cfg),
		commands.NewRestoreCmd(cfg),
		commands.NewMonitorCmd(cfg),
		newVersionCmd(),
		newCompletionCmd(rootCmd),
	)

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func newVersionCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print version information",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("tenantctl %s\n", version)
			fmt.Printf("commit: %s\n", commit)
			fmt.Printf("built: %s\n", date)
		},
	}
}

func newCompletionCmd(rootCmd *cobra.Command) *cobra.Command {
	completionCmd := &cobra.Command{
		Use:   "completion",
		Short: "Generate shell completion scripts",
		Long: `Generate shell completion scripts for various shells.
To load completions:
Bash:
  $ source <(tenantctl completion bash)
  # To load completions for each session, execute once:
  # Linux:
  $ tenantctl completion bash > /etc/bash_completion.d/tenantctl
  # macOS:
  $ tenantctl completion bash > /usr/local/etc/bash_completion.d/tenantctl
Zsh:
  $ source <(tenantctl completion zsh)
  # To load completions for each session, execute once:
  $ tenantctl completion zsh > "${fpath[1]}/_tenantctl"
Fish:
  $ tenantctl completion fish | source
  # To load completions for each session, execute once:
  $ tenantctl completion fish > ~/.config/fish/completions/tenantctl.fish
PowerShell:
  PS> tenantctl completion powershell | Out-String | Invoke-Expression
  # To load completions for every new session, run:
  PS> tenantctl completion powershell > tenantctl.ps1
  # and source this file from your PowerShell profile.
`,
	}
	completionCmd.AddCommand(
		&cobra.Command{
			Use:   "bash",
			Short: "Generate bash completion script",
			RunE: func(cmd *cobra.Command, args []string) error {
				return rootCmd.GenBashCompletion(os.Stdout)
			},
		},
		&cobra.Command{
			Use:   "zsh",
			Short: "Generate zsh completion script",
			RunE: func(cmd *cobra.Command, args []string) error {
				return rootCmd.GenZshCompletion(os.Stdout)
			},
		},
		&cobra.Command{
			Use:   "fish",
			Short: "Generate fish completion script",
			RunE: func(cmd *cobra.Command, args []string) error {
				return rootCmd.GenFishCompletion(os.Stdout, true)
			},
		},
		&cobra.Command{
			Use:   "powershell",
			Short: "Generate powershell completion script",
			RunE: func(cmd *cobra.Command, args []string) error {
				return rootCmd.GenPowerShellCompletionWithDesc(os.Stdout)
			},
		},
	)
	return completionCmd
}