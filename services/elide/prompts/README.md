# Elideable Prompting System

This directory contains the prompting strategies for different AI models.

## Prompt Modules

### `qwen-plan-v2.mjs` - Simple Prompt (Small Models)
**Target Models:**
- Qwen 2.5 1.5B-3B
- Gemma 2 2B
- Phi-3 Mini
- Any model < 3B parameters

**Design Philosophy:**
- **SHORT**: ~500 tokens total
- **CONCRETE**: Examples over explanations
- **STRUCTURED**: Clear sections with minimal nesting

**Key Features:**
- Explicit JSON schema
- Max 3 critical rules
- 2 complete working examples
- No abstract concepts

### `advanced-plan.mjs` - Advanced Prompt (Large Models)
**Target Models:**
- Claude 3.5 Sonnet / GPT-4 / Gemini 1.5 Pro
- Qwen 2.5 Coder 7B+
- DeepSeek Coder 6.7B+
- Codestral 22B
- Any model 7B+ parameters

**Design Philosophy:**
- **COMPREHENSIVE**: ~2000 tokens
- **DETAILED**: Best practices, patterns, architecture
- **PROFESSIONAL**: Production-quality code standards

**Key Features:**
- Complete code quality standards
- Architecture patterns (state management, persistence, API integration)
- Accessibility and responsive design guidelines
- Multiple detailed examples
- Pre-flight checklist

## Model Selection Logic

The system automatically chooses the appropriate prompt based on model name:

```javascript
const isLargeModel = mdl.includes('7b') || mdl.includes('14b') || 
                     mdl.includes('32b') || mdl.includes('coder');
```

## Recommended Models by Hardware

### Laptop (32GB RAM, 14GB free disk)
**Current:** `qwen2.5:1.5b-instruct-q8_0` (1.6GB)
**Recommended Upgrade:** `qwen2.5-coder:7b-instruct-q4_K_M` (~4.5GB download, ~6-8GB RAM)

```bash
ollama pull qwen2.5-coder:7b-instruct-q4_K_M
```

**Why Qwen 2.5 Coder 7B?**
- Specifically trained for code generation
- 4-5x better than 1.5B at following complex instructions
- Handles multi-file projects reliably
- Still fits in 32GB RAM with room for OS/browser
- Q4_K_M quantization: good quality/speed balance

**Alternative:** `deepseek-coder:6.7b-instruct-q4_K_M` (~4GB)

### Desktop (96GB RAM)
**Recommended:** `qwen2.5-coder:32b-instruct-q4_K_M` (~18GB download, ~24GB RAM)

```bash
ollama pull qwen2.5-coder:32b-instruct-q4_K_M
```

**Why 32B?**
- Near GPT-4 level code generation
- Excellent at architecture decisions
- Handles complex refactoring
- Can work with large codebases

**Alternative:** `codestral:22b-v0.1-q4_K_M` (~13GB)

### Remote/Cloud (Unlimited)
Use the advanced prompt with:
- `anthropic/claude-3.5-sonnet`
- `openai/gpt-4-turbo`
- `google/gemini-1.5-pro`

## Environment Variables

```bash
# Set your preferred model
export OLLAMA_MODEL="qwen2.5-coder:7b-instruct-q4_K_M"

# Or use remote provider
export ELV_PROVIDER="openrouter"
export OPENROUTER_API_KEY="your-key"
```

## Testing Prompts

To test a specific prompt:

```bash
# Test simple prompt (small model)
curl -X POST http://localhost:8787/api/ai/plan \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"make a calculator","model":"ollama:qwen2.5:1.5b-instruct-q8_0"}'

# Test advanced prompt (large model)
curl -X POST http://localhost:8787/api/ai/plan \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"make a calculator","model":"ollama:qwen2.5-coder:7b-instruct-q4_K_M"}'
```

## Prompt Engineering Best Practices

### For Small Models (< 3B)
1. **Be explicit**: Show exact output format
2. **Use examples**: 2-3 complete working examples
3. **Keep it short**: < 1000 tokens total
4. **Avoid abstractions**: Concrete over conceptual
5. **One task**: Don't mix multiple objectives

### For Large Models (7B+)
1. **Provide context**: Explain the "why" behind rules
2. **Show patterns**: Architecture and design patterns
3. **Set standards**: Code quality expectations
4. **Give examples**: Multiple complexity levels
5. **Add checklists**: Pre-flight verification steps

## Benchmarking

To compare model performance:

```bash
# Run the same prompt with different models
for model in "qwen2.5:1.5b" "qwen2.5-coder:7b" "qwen2.5-coder:32b"; do
  echo "Testing $model..."
  time curl -X POST http://localhost:8787/api/ai/plan \
    -H 'Content-Type: application/json' \
    -d "{\"prompt\":\"create a todo app with localStorage\",\"model\":\"ollama:$model\"}" \
    > "benchmark-$model.json"
done
```

## Future Improvements

- [ ] Add prompt for specialized tasks (data viz, forms, animations)
- [ ] Create prompt for successive edits (diff-based)
- [ ] Add few-shot examples from successful generations
- [ ] Implement prompt caching for large models
- [ ] Add model-specific optimizations (Qwen vs Gemma vs DeepSeek)

## References

- [Qwen 2.5 Coder Documentation](https://qwen.readthedocs.io/)
- [Cursor Agent Patterns](https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools/tree/main/Cursor%20Prompts)
- [Anthropic Prompt Engineering](https://docs.anthropic.com/claude/docs/prompt-engineering)
- [OpenAI Best Practices](https://platform.openai.com/docs/guides/prompt-engineering)

