// src/hooks/useWebSpeech.js
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const useWebSpeech = () => {
    const [transcript, setTranscript] = useState('');
    const [listening, setListening] = useState(false);
    const [recognitionInstance, setRecognitionInstance] = useState(null);
    const [error, setError] = useState(null);
    const isSpeechSupported = !!SpeechRecognition;

    useEffect(() => {
        if (!isSpeechSupported) {
            console.warn("Web Speech API is not supported by this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        // Final-only mode prevents incremental prefix repeats from being
        // appended multiple times into the chat input.
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            // Consume only the latest result slice (event.resultIndex) and only
            // emit stable text once per utterance.
            const result = event.results[event.resultIndex];
            const currentTranscript = result?.[0]?.transcript?.trim() || '';
            if (!currentTranscript) return;
            setTranscript(currentTranscript);
            setError(null);
        };

        recognition.onerror = (event) => {
            // "no-speech" and "aborted" are expected in normal usage and
            // should not be logged as hard errors in console.
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                console.error("Speech recognition error:", event.error);
            }

            switch (event.error) {
                case 'no-speech':
                    // Browser timed out waiting for voice — normal case, stop quietly
                    setListening(false);
                    setError(null);
                    break;
                case 'aborted':
                    // Manually stopped — ignore
                    setListening(false);
                    setError(null);
                    break;
                case 'audio-capture':
                    setError('Microphone not found or already in use.');
                    toast.error('Microphone not found or already in use.');
                    setListening(false);
                    break;
                case 'not-allowed':
                    setError('Microphone permission denied.');
                    toast.error('Microphone access denied — allow it in browser settings.');
                    setListening(false);
                    break;
                case 'network':
                    // Chrome requires internet for its STT cloud backend
                    setError('Network error — check your connection.');
                    toast.error('Voice input needs an internet connection.');
                    setListening(false);
                    break;
                default:
                    setError(event.error);
                    setListening(false);
            }
        };

        recognition.onend = () => {
            setListening(false);
        };

        setRecognitionInstance(recognition);

        return () => {
            recognition.abort();
        };
    }, [isSpeechSupported]);

    const startListening = useCallback(async () => {
        if (!recognitionInstance || listening) return;

        // On secure contexts, proactively request mic permission via getUserMedia
        // so the browser shows the permission prompt before recognition starts.
        // This prevents silent "not-allowed" errors from the speech API.
        if (window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
            try {
                const stream = await navigator.mediaDevices?.getUserMedia({ audio: true });
                // Immediately release the stream — we only needed the permission grant
                stream?.getTracks().forEach(t => t.stop());
            } catch {
                // Permission denied — recognition.start() will also fail, skip it
                setError('Microphone permission denied.');
                return;
            }
        }

        try {
            setTranscript('');
            setError(null);
            recognitionInstance.start();
            setListening(true);
        } catch (e) {
            console.error('Error starting speech recognition:', e);
            setError('Could not start voice input.');
            setListening(false);
        }
    }, [recognitionInstance, listening]);

    const stopListening = useCallback(() => {
        if (recognitionInstance && listening) {
            recognitionInstance.stop();
        }
    }, [recognitionInstance, listening]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
    }, []);


    return {
        transcript,
        listening,
        isSpeechSupported,
        startListening,
        stopListening,
        resetTranscript,
        error // Expose error state
    };
};