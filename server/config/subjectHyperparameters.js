// server/config/subjectHyperparameters.js

/**
 * Subject-Specific Hyperparameters for Fine-Tuning
 */
const subjectConfigs = {
    "mathematics": {
        "learning_rate": 2e-4,
        "lora_r": 16,
        "lora_alpha": 32,
        "target_modules": ["q_proj", "v_proj"],
        "context_length": 2048
    },
    "literature": {
        "learning_rate": 1e-4,
        "lora_r": 8,
        "lora_alpha": 16,
        "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj"],
        "context_length": 4096
    },
    "computer_science": {
        "learning_rate": 3e-4,
        "lora_r": 32,
        "lora_alpha": 64,
        "target_modules": ["q_proj", "v_proj", "dense"],
        "context_length": 2048
    },
    "default": {
        "learning_rate": 2e-4,
        "lora_r": 16,
        "lora_alpha": 32,
        "target_modules": ["q_proj", "v_proj"],
        "context_length": 2048
    }
};

function getHyperparametersForSubject(subject) {
    return subjectConfigs[subject.toLowerCase()] || subjectConfigs.default;
}

module.exports = { getHyperparametersForSubject };
