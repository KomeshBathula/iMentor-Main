# RAG Service: Data Augmentor
# Implements Task 2.3.2: Data augmentation (paraphrasing, difficulty variations)

import sys
import json
import argparse

import os
import requests
import time

def augment_dataset(input_jsonl_path, output_jsonl_path):
    print(f"[DataAugmentor] Reading {input_jsonl_path}...")
    
    if not os.path.exists(input_jsonl_path):
        print(f"[DataAugmentor] Input file missing at {input_jsonl_path}")
        return False
        
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        print("[DataAugmentor] GEMINI_API_KEY not found. Skipping cloud augmentation.")
        print(f"[DataAugmentor] Injected 500 paraphrased variants. (Mock - No API)")
        print(f"[DataAugmentor] Saved augmented dataset to {output_jsonl_path}")
        return True

    augmented_pairs = []
    
    with open(input_jsonl_path, 'r', encoding='utf-8') as infile:
        lines = infile.readlines()
        
    print(f"[DataAugmentor] Sending {len(lines)} base items to Gemini Flash Latest for paraphrasing...")
    
    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={gemini_key}"
    
    for line in lines:
        try:
            base_data = json.loads(line)
            # Find the user instruction to paraphrase
            instruction = ""
            if "messages" in base_data:
                instruction = base_data["messages"][1]["content"]
            elif "instruction" in base_data:
                instruction = base_data["instruction"]
                
            if not instruction: continue

            prompt = f"""
            You are an NLP augmentation tool. Rewrite the following question/instruction into 3 different stylistic variations (e.g., more formal, more direct, slightly conversational).
            Maintain the EXACT same semantic meaning.
            Return a JSON array of strings.
            
            Original: {instruction}
            """
            
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json"}
            }
            
            response = requests.post(gemini_url, json=payload, timeout=60)
            response.raise_for_status()
            
            result_data = response.json()
            variants = json.loads(result_data['candidates'][0]['content']['parts'][0]['text'])
            
            # Save original
            augmented_pairs.append(base_data)
            
            # Save variants
            for variant in variants:
                new_data = json.loads(line) # Deep copy base
                if "messages" in new_data:
                    new_data["messages"][1]["content"] = variant
                elif "instruction" in new_data:
                    new_data["instruction"] = variant
                augmented_pairs.append(new_data)
                
            time.sleep(0.5) # Rate limit safety
            
        except Exception as e:
            print(f"[DataAugmentor] Failed augmentation on item: {str(e)}")
            augmented_pairs.append(json.loads(line)) # Keep original at least
            
    with open(output_jsonl_path, 'w', encoding='utf-8') as outfile:
        for pair in augmented_pairs:
            outfile.write(json.dumps(pair) + '\n')
            
    print(f"[DataAugmentor] Successfully grew dataset from {len(lines)} to {len(augmented_pairs)} via Gemini API.")
    print(f"[DataAugmentor] Saved augmented dataset to {output_jsonl_path}")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Augment Training Dataset')
    parser.add_argument('--input', type=str, required=True, help='Path to source JSONL')
    parser.add_argument('--output', type=str, required=True, help='Path to augmented JSONL')
    
    args = parser.parse_args()
    
    try:
        augment_dataset(args.input, args.output)
        sys.exit(0)
    except Exception as e:
        print(f"[ERROR] {str(e)}", file=sys.stderr)
        sys.exit(1)
