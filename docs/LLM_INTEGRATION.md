# LLM Integration for Sentinel Agent

## Overview

The Sentinel Agent now includes local LLM capabilities for intelligent security analysis, remediation recommendations, and threat classification. This integration uses state-of-the-art open-source models running locally on the endpoint for maximum privacy and security.

## Architecture

### Components

1. **agent-llm** - Core LLM inference engine
2. **Mistral.rs** - High-performance model runtime
3. **Qwen3-Coder 7B** - Specialized model for code and security analysis
4. **Intelligent Scanner** - Enhanced scanner with LLM integration

### Features

- **Intelligent Analysis**: AI-powered analysis of compliance scan results
- **Automated Remediation**: Step-by-step remediation guidance
- **Threat Classification**: Security event classification using MITRE ATT&CK
- **Code Analysis**: Security-focused code review capabilities
- **Local Processing**: All inference happens locally, no data leaves the endpoint

## Model Selection

### Recommended Models

| Model | Use Case | Size | VRAM | Strengths |
|-------|----------|------|------|-----------|
| Qwen3-Coder 7B | Code & Security Analysis | 4.7GB | 6GB | Best for Rust/security analysis |
| Llama 4 8B | General Analysis | 5.2GB | 8GB | Balanced capabilities |
| DeepSeek-R1 8B | Complex Reasoning | 5.8GB | 8GB | Advanced threat analysis |
| Gemma 3 4B | Lightweight Tasks | 2.8GB | 4GB | Basic classification |

### Model Capabilities

- **Code Analysis**: Syntax analysis, vulnerability detection, best practices
- **Security Analysis**: Threat assessment, compliance impact, risk scoring
- **Remediation**: Step-by-step fix procedures, verification steps
- **Classification**: Threat categorization, severity assessment
- **Summarization**: Executive summaries, trend analysis

## Installation

### Prerequisites

```bash
# Install Rust with required features
cargo build --release --features llm

# Download model files (example with Qwen3-Coder)
mkdir -p models
cd models
wget https://huggingface.co/Qwen/Qwen3-Coder-7B-Instruct-GGUF/resolve/main/qwen3-coder-7b-instruct-q4_k_m.gguf
```

### Configuration

1. Copy the example configuration:
```bash
cp config/llm.example.json config/llm.json
```

2. Update the model path and settings:
```json
{
  "model": {
    "name": "qwen3-coder-7b",
    "path": "/path/to/models/qwen3-coder-7b.Q4_K_M.gguf",
    "model_type": "Qwen3Coder",
    "gpu_layers": 0
  }
}
```

## Usage

### Basic Integration

```rust
use agent_scanner::{IntelligentCheckRunner, CheckRunner};
use agent_llm::{LLMManager, LLMConfig};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load LLM configuration
    let config = LLMConfig::from_file(&PathBuf::from("config/llm.json"))?;
    
    // Create LLM manager
    let llm_manager = Arc::new(LLMManager::new(config).await?);
    
    // Create intelligent scanner
    let base_runner = CheckRunner::with_defaults(registry);
    let intelligent_runner = IntelligentCheckRunner::new(
        base_runner, 
        Some(llm_manager)
    ).await?;
    
    // Run scan with AI analysis
    let result = intelligent_runner.run_with_analysis(
        "Linux Server",
        "ISO 27001",
        "Server"
    ).await?;
    
    // Access AI insights
    if let Some(analysis) = result.llm_analysis {
        println!("Risk Level: {:?}", analysis.risk_assessment.risk_level);
        println!("Priority Issues: {}", analysis.priority_issues.len());
    }
    
    Ok(())
}
```

### Analysis Results

The LLM integration provides:

1. **Risk Assessment**
   - Overall risk level (Low/Medium/High/Critical)
   - Risk categories and scores
   - Business impact analysis

2. **Priority Issues**
   - Ranked list of security issues
   - Affected systems and components
   - Business impact assessment

3. **Compliance Impact**
   - Framework-specific impact analysis
   - Affected requirements
   - Potential compliance gaps

4. **Recommendations**
   - Actionable remediation steps
   - Implementation guidance
   - Verification procedures

### Remediation Plans

```rust
if let Some(plan) = result.remediation_plan {
    println!("Remediation Plan: {}", plan.title);
    println!("Estimated Duration: {}", plan.estimated_total_duration);
    
    for action in plan.actions {
        println!("Action: {} [{}]", action.title, action.priority);
        println!("Commands: {:?}", action.commands);
        println!("Verification: {:?}", action.verification_steps);
    }
}
```

## Performance Optimization

### Memory Management

- **GPU Offloading**: Set `gpu_layers` > 0 to accelerate inference
- **Context Size**: Adjust `max_context_size` based on available memory
- **Thread Count**: Set `threads` to number of CPU cores for optimal performance

### Caching

Enable response caching to reduce inference time for repeated analyses:

```json
{
  "cache": {
    "enabled": true,
    "directory": "cache/llm",
    "max_size_mb": 1024,
    "ttl_hours": 24
  }
}
```

### Batch Processing

Process multiple scan results together for better efficiency:

```rust
let results = intelligent_runner.run_with_analysis(
    system_info,
    compliance_framework,
    asset_type
).await?;
```

## Security Considerations

### Input Sanitization

The LLM integration includes built-in security measures:

- Input length limits
- Pattern-based content filtering
- Sensitive data redaction
- Audit logging

### Privacy

- All inference happens locally on the endpoint
- No data is transmitted to external services
- Model files are stored locally
- Cache can be cleared for data hygiene

### Access Control

LLM features respect the agent's existing RBAC system:

- Only authorized users can trigger AI analysis
- Audit trails track all LLM interactions
- Results are stored with appropriate access controls

## Troubleshooting

### Common Issues

1. **Model Loading Fails**
   - Check model file path and permissions
   - Verify sufficient disk space and memory
   - Ensure correct model format (GGUF)

2. **Slow Inference**
   - Enable GPU acceleration with `gpu_layers`
   - Reduce `max_context_size` if memory constrained
   - Increase `threads` for CPU parallelism

3. **Poor Quality Results**
   - Adjust `temperature` (lower for more deterministic results)
   - Fine-tune `top_p` and `top_k` parameters
   - Ensure model matches use case (Qwen3-Coder for security analysis)

### Debug Mode

Enable debug logging for troubleshooting:

```bash
RUST_LOG=debug ./sentinel-agent --llm-debug
```

### Model Validation

Validate model compatibility:

```rust
let validation = llm_manager.validate_model().await?;
if !validation.is_valid {
    println!("Model errors: {:?}", validation.errors);
}
```

## Integration Examples

### Security Event Analysis

```rust
let event = SecurityEvent {
    id: "evt-001".to_string(),
    event_type: "Suspicious Process".to_string(),
    description: "Unusual network activity detected".to_string(),
    // ... other fields
};

let classification = llm_manager.classifier().classify_event(&event).await?;
println!("Threat Type: {:?}", classification.threat_type);
println!("Confidence: {}", classification.confidence);
```

### Code Security Review

```rust
let code_analysis = llm_manager.analyzer().analyze_code(
    rust_code,
    "OWASP Top 10",
    "Authentication Module"
).await?;

println!("Vulnerabilities Found: {}", code_analysis.vulnerabilities.len());
for vuln in code_analysis.vulnerabilities {
    println!("{}: {}", vuln.severity, vuln.description);
}
```

## Future Enhancements

### Planned Features

1. **Multi-Model Support**: Automatic model selection based on task
2. **Fine-Tuning**: Custom models for specific environments
3. **Real-time Analysis**: Continuous monitoring with AI insights
4. **Integration APIs**: REST API for external LLM services
5. **Model Updates**: Automatic model downloading and updates

### Research Areas

1. **Federated Learning**: Collaborative model improvement
2. **Edge Optimization**: Model compression for resource-constrained devices
3. **Explainable AI**: Better interpretability of security recommendations
4. **Adaptive Learning**: Models that learn from local environment patterns

## Support

For issues with LLM integration:

1. Check the logs at `logs/agent.log`
2. Verify model file integrity
3. Ensure sufficient system resources
4. Review configuration settings

## License

The LLM integration is covered under the Sentinel Agent proprietary license. Model files may have separate licenses from their respective providers.
