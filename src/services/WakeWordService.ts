export class WakeWordService {
    private recognition: any;
    private isListening: boolean = false;
    private onWakeWord: () => void;

    constructor(onWakeWord: () => void) {
        this.onWakeWord = onWakeWord;
        this.initRecognition();
    }

    private initRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech Recognition not supported in this browser.');
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event: any) => {
            const last = event.results.length - 1;
            const transcript = event.results[last][0].transcript.toLowerCase();

            console.log('[WakeWord] Transcript:', transcript);

            const variations = ['hi gemdesk', 'hey gemdesk', 'ai gemdesk', 'hi gem desk', 'hey gem desk', 'okay gemdesk', 'hi game desk', 'hi gumdesk'];
            if (variations.some(v => transcript.includes(v))) {
                console.log('[WakeWord] Wake word detected!');
                this.onWakeWord();
            } else if (transcript.includes('gemdesk') || transcript.includes('gem desk')) {
                console.log('[WakeWord] Partially detected Gemdesk, keeping an eye out...');
            }
        };

        this.recognition.onstart = () => {
            console.log('[WakeWord] Recognition service started');
        };

        this.recognition.onend = () => {
            if (this.isListening) {
                console.log('[WakeWord] Restarting recognition...');
                this.recognition.start();
            }
        };

        this.recognition.onerror = (event: any) => {
            console.error('[WakeWord] Error:', event.error);
            if (event.error === 'network' || event.error === 'not-allowed') {
                this.isListening = false;
            } else {
                // Try to restart on minor errors
                setTimeout(() => {
                    if (this.isListening) this.recognition.start();
                }, 1000);
            }
        };
    }

    start() {
        if (this.recognition && !this.isListening) {
            this.isListening = true;
            this.recognition.start();
            console.log('[WakeWord] Started listening...');
        }
    }

    stop() {
        if (this.recognition && this.isListening) {
            this.isListening = false;
            this.recognition.stop();
            console.log('[WakeWord] Stopped listening.');
        }
    }
}
