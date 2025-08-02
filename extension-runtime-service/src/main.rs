use anyhow::{Context, Result};
use metrics::{counter, gauge, histogram};
use prometheus::{Encoder, TextEncoder};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::time::timeout;
use tracing::{error, info, instrument, warn};
use warp::Filter;
use wasmtime::*;
use wasmtime_wasi::{WasiCtx, WasiCtxBuilder};
use std::path::Path;

// Enhanced configuration for safety
#[derive(Clone)]
struct RuntimeConfig {
    max_memory_pages: u32,
    max_table_elements: u32,
    max_instances: u32,
    fuel_limit: u64,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            max_memory_pages: 100, // ~6.4MB limit
            max_table_elements: 1000,
            max_instances: 10,
            fuel_limit: 1_000_000, // Computational limit
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    // Register metrics
    prometheus::register_counter!(
        "plugin_executions_total",
        "Total number of plugin executions"
    ).unwrap();
    prometheus::register_counter!(
        "plugin_execution_failures_total",
        "Total number of failed plugin executions"
    ).unwrap();
    prometheus::register_histogram!(
        "plugin_execution_duration_seconds",
        "Duration of plugin executions in seconds",
        vec![0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
    ).unwrap();
    prometheus::register_gauge!(
        "active_plugin_instances",
        "Number of active plugin instances"
    ).unwrap();
    info!("Starting Enhanced Extension Runtime Service");
    let config = RuntimeConfig::default();
    let engine = create_secure_engine(&config)?;
    let state = Arc::new(ServiceState {
        engine,
        config,
        active_instances: Arc::new(std::sync::atomic::AtomicU32::new(0)),
    });
    let metrics_route = warp::path("metrics").and_then(handle_metrics);
    let execute_route = warp::post()
        .and(warp::path("execute"))
        .and(warp::body::content_length_limit(1024 * 1024)) // 1MB limit
        .and(warp::body::json())
        .and(warp::any().map(move || state.clone()))
        .and_then(handle_execute);
    let routes = metrics_route.or(execute_route);
    info!("Enhanced secure server running on http://localhost:8080");
    warp::serve(routes).run(([127, 0, 0, 1], 8080)).await;
    Ok(())
}

struct ServiceState {
    engine: Engine,
    config: RuntimeConfig,
    active_instances: Arc<std::sync::atomic::AtomicU32>,
}

#[derive(serde::Deserialize, Debug)]
struct ExecuteRequest {
    module_path: String,
    function_name: String,
    params: serde_json::Value, // More flexible parameter handling
    timeout_seconds: Option<u64>,
}

#[derive(serde::Serialize)]
struct ExecuteResponse {
    success: bool,
    result: Option<serde_json::Value>,
    error: Option<String>,
    execution_time_ms: u64,
    memory_used_bytes: u64,
    fuel_consumed: u64,
}

fn create_secure_engine(_config: &RuntimeConfig) -> Result<Engine> {
    let mut engine_config = Config::new();
    // Security configurations
    engine_config.wasm_backtrace_details(WasmBacktraceDetails::Enable);
    engine_config.consume_fuel(true); // Enable fuel-based limiting
    engine_config.epoch_interruption(true);
    // Resource limits
    engine_config.max_wasm_stack(512 * 1024); // 512KB stack limit
    engine_config.wasm_multi_memory(false); // Disable multiple memories
    engine_config.wasm_memory64(false); // Disable 64-bit memory
    // Disable potentially dangerous features
    engine_config.wasm_threads(false);
    engine_config.wasm_reference_types(false);
    engine_config.wasm_simd(false);
    engine_config.wasm_relaxed_simd(false);
    engine_config.wasm_bulk_memory(false);
    Ok(Engine::new(&engine_config)?)
}

async fn handle_metrics() -> Result<impl warp::Reply, warp::Rejection> {
    let encoder = TextEncoder::new();
    let mut buffer = Vec::new();
    let metric_families = prometheus::gather();
    encoder.encode(&metric_families, &mut buffer).unwrap();
    Ok(String::from_utf8(buffer).unwrap())
}

#[instrument(skip(state), fields(module_path = %req.module_path, function = %req.function_name))]
async fn handle_execute(
    req: ExecuteRequest,
    state: Arc<ServiceState>,
) -> Result<impl warp::Reply, warp::Rejection> {
    // Check instance limit
    let current_instances = state.active_instances.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    if current_instances >= state.config.max_instances {
        state.active_instances.fetch_sub(1, std::sync::atomic::Ordering::SeqCst);
        counter!("plugin_execution_failures_total", "reason" => "instance_limit");
        return Ok(warp::reply::json(&ExecuteResponse {
            success: false,
            result: None,
            error: Some("Too many active instances".to_string()),
            execution_time_ms: 0,
            memory_used_bytes: 0,
            fuel_consumed: 0,
        }));
    }
    let execution_timeout = Duration::from_secs(
        req.timeout_seconds.unwrap_or(30).min(300) // Max 5 minutes
    );
    let result = timeout(execution_timeout, execute_plugin_safe(&state.engine, &req, &state.config)).await;
    // Decrement active instances
    state.active_instances.fetch_sub(1, std::sync::atomic::Ordering::SeqCst);
    gauge!("active_plugin_instances");
    match result {
        Ok(Ok(response)) => {
            counter!("plugin_executions_total", "status" => "success");
            let duration_secs = response.execution_time_ms as f64 / 1000.0;
            histogram!("plugin_execution_duration_seconds").record(duration_secs);  // Fixed line
            Ok(warp::reply::json(&response))
        }
        Ok(Err(e)) => {
            counter!("plugin_execution_failures_total", "reason" => "execution_error");
            error!("Plugin execution failed: {}", e);
            Ok(warp::reply::json(&ExecuteResponse {
                success: false,
                result: None,
                error: Some(format!("Execution error: {}", e)),
                execution_time_ms: 0,
                memory_used_bytes: 0,
                fuel_consumed: 0,
            }))
        }
        Err(_) => {
            counter!("plugin_execution_failures_total", "reason" => "timeout");
            warn!("Plugin execution timed out");
            Ok(warp::reply::json(&ExecuteResponse {
                success: false,
                result: None,
                error: Some("Execution timed out".to_string()),
                execution_time_ms: execution_timeout.as_millis() as u64,
                memory_used_bytes: 0,
                fuel_consumed: 0,
            }))
        }
    }
}

async fn execute_plugin_safe(
    engine: &Engine,
    req: &ExecuteRequest,
    config: &RuntimeConfig
) -> Result<ExecuteResponse> {
    let start = Instant::now();
    // Use a configurable base directory (default to server working dir)
    let base_dir = std::env::var("WASM_MODULE_DIR")
        .unwrap_or_else(|_| "/Users/karassayraushanbek/Documents/work/multi-saas-crm/extension-runtime-service".to_string());
    // Resolve module path
    let module_path = Path::new(&base_dir).join(&req.module_path).canonicalize()
        .with_context(|| format!("Invalid module path: {}", req.module_path))?;
    // Prevent directory traversal (redundant with canonicalize, but extra safety)
    if module_path.to_str().unwrap().contains("..") {
        anyhow::bail!("Directory traversal detected");
    }
    // Load and validate module
    let module_bytes = std::fs::read(&module_path)
        .with_context(|| format!("Failed to read WASM module at {}", module_path.display()))?;
    if module_bytes.len() > 10 * 1024 * 1024 { // 10MB limit
        anyhow::bail!("Module too large");
    }
    let module = Module::from_binary(engine, &module_bytes)
        .context("Failed to parse WASM module")?;
    // Validate module exports/imports
    validate_module_safety(&module)?;
    // Set up secure linker
    let mut linker: Linker<WasiCtx> = Linker::new(engine);
    wasmtime_wasi::add_to_linker(&mut linker, |s| s)?;
    // Create restricted WASI context
    let wasi_ctx = WasiCtxBuilder::new()
        .inherit_stdio() // Only allow stdio, no file system access
        .build();
    let mut store = Store::new(engine, wasi_ctx);
    // Set resource limits - fuel is enabled in engine config
    store.set_fuel(config.fuel_limit)?;
    store.set_epoch_deadline(1);
    // Configure memory limits
    let memory_limit = config.max_memory_pages as usize * 65536;
    let table_limit = config.max_table_elements as usize;
    store.limiter(move |_| {
        Box::leak(Box::new(ResourceLimiter {
            memory_limit,
            table_limit,
        }))
    });
    let instance = linker
        .instantiate(&mut store, &module)
        .context("Failed to instantiate module")?;
    // Get and validate function
    let func = instance
        .get_func(&mut store, &req.function_name)
        .context("Function not found")?;
    let func_type = func.ty(&store);
    let param_types: Vec<ValType> = func_type.params().collect();
    let result_types: Vec<ValType> = func_type.results().collect();
    // Measure initial memory
    let memory = instance.get_memory(&mut store, "memory");
    let initial_memory = if let Some(mem) = memory {
        mem.size(&store) as u64 * 65536
    } else {
        0
    };
    // Execute function with parameter validation
    let result = execute_function_with_params(&mut store, func, &param_types, &result_types, &req.params)
        .context("Function execution failed")?;
    let execution_time = start.elapsed().as_millis() as u64;
    let fuel_consumed = config.fuel_limit - store.get_fuel().unwrap_or(0);
    // Measure final memory
    let final_memory = if let Some(mem) = memory {
        mem.size(&store) as u64 * 65536
    } else {
        0
    };
    info!(
        "Plugin executed successfully: function={}, time={}ms, fuel={}, memory_delta={}",
        req.function_name, execution_time, fuel_consumed, final_memory - initial_memory
    );
    Ok(ExecuteResponse {
        success: true,
        result: Some(result),
        error: None,
        execution_time_ms: execution_time,
        memory_used_bytes: final_memory - initial_memory,
        fuel_consumed,
    })
}

fn validate_module_safety(module: &Module) -> Result<()> {
    // Check for suspicious imports
    for import in module.imports() {
        match import.module() {
            "wasi_snapshot_preview1" => continue, // Allow WASI
            "env" => {
                // Allow only safe env imports
                match import.name() {
                    "memory" | "table" => continue,
                    _ => anyhow::bail!("Unsafe import: env.{}", import.name()),
                }
            }
            _ => anyhow::bail!("Unauthorized import module: {}", import.module()),
        }
    }
    Ok(())
}

fn execute_function_with_params(
    store: &mut Store<WasiCtx>,
    func: Func,
    param_types: &[ValType],
    result_types: &[ValType],
    params: &serde_json::Value,
) -> Result<serde_json::Value> {
    // Convert JSON params to WASM values
    let param_values = json_to_wasm_params(params, param_types)?;
    // Execute function
    let mut results = vec![Val::I32(0); result_types.len()];
    func.call(store, &param_values, &mut results)?;
    // Convert results back to JSON
    wasm_results_to_json(&results)
}

fn json_to_wasm_params(json: &serde_json::Value, param_types: &[ValType]) -> Result<Vec<Val>> {
    let params_array = match json {
        serde_json::Value::Array(arr) => arr,
        _ => anyhow::bail!("Parameters must be an array"),
    };
    if params_array.len() != param_types.len() {
        anyhow::bail!("Parameter count mismatch");
    }
    let mut wasm_params = Vec::new();
    for (json_param, wasm_type) in params_array.iter().zip(param_types.iter()) {
        let wasm_val = match (json_param, wasm_type) {
            (serde_json::Value::Number(n), ValType::I32) => {
                Val::I32(n.as_i64().context("Invalid i32")? as i32)
            }
            (serde_json::Value::Number(n), ValType::I64) => {
                Val::I64(n.as_i64().context("Invalid i64")?)
            }
            (serde_json::Value::Number(n), ValType::F32) => {
                Val::F32((n.as_f64().context("Invalid f32")? as f32).to_bits())
            }
            (serde_json::Value::Number(n), ValType::F64) => {
                Val::F64(n.as_f64().context("Invalid f64")?.to_bits())
            }
            _ => anyhow::bail!("Unsupported parameter type combination"),
        };
        wasm_params.push(wasm_val);
    }
    Ok(wasm_params)
}

fn wasm_results_to_json(results: &[Val]) -> Result<serde_json::Value> {
    if results.len() == 1 {
        // Single result
        Ok(wasm_val_to_json(&results[0])?)
    } else {
        // Multiple results as array
        let json_results: Result<Vec<_>> = results.iter().map(wasm_val_to_json).collect();
        Ok(serde_json::Value::Array(json_results?))
    }
}

fn wasm_val_to_json(val: &Val) -> Result<serde_json::Value> {
    match val {
        Val::I32(i) => Ok(serde_json::Value::Number((*i).into())),
        Val::I64(i) => Ok(serde_json::Value::Number((*i).into())),
        Val::F32(f) => Ok(serde_json::Value::Number(
            serde_json::Number::from_f64(f32::from_bits(*f) as f64)
                .context("Invalid f32")?
        )),
        Val::F64(f) => Ok(serde_json::Value::Number(
            serde_json::Number::from_f64(f64::from_bits(*f))
                .context("Invalid f64")?
        )),
        _ => anyhow::bail!("Unsupported result type"),
    }
}

struct ResourceLimiter {
    memory_limit: usize,
    table_limit: usize,
}

impl wasmtime::ResourceLimiter for ResourceLimiter {
    fn memory_growing(&mut self, _current: usize, desired: usize, _maximum: Option<usize>) -> anyhow::Result<bool> {
        Ok(desired <= self.memory_limit)
    }

    fn table_growing(&mut self, _current: u32, desired: u32, _maximum: Option<u32>) -> anyhow::Result<bool> {
        Ok(desired <= self.table_limit as u32)
    }
}