export class AudioService {
  private ctx: AudioContext | null = null;
  private droneNodes: OscillatorNode[] = [];
  private gainNodes: GainNode[] = [];
  private isInitialized = false;

  constructor() {
    // Only init on user interaction due to browser policies
  }

  init() {
    if (this.isInitialized) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    this.isInitialized = true;
    this.startDrone();
  }

  // Generates a low frequency horror drone
  private startDrone() {
    if (!this.ctx) return;

    // Create 3 oscillators for a dissonant chord
    const freqs = [55, 58, 110]; // Low A, Bb (dissonant), A2
    
    freqs.forEach(f => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, this.ctx!.currentTime);
      
      // Low pass filter to make it "muffled" like through a wall
      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 200;

      // LFO for volume modulation (unsettling breathing effect)
      const lfo = this.ctx!.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.1 + Math.random() * 0.2; // Very slow
      const lfoGain = this.ctx!.createGain();
      lfoGain.gain.value = 0.1; // Modulate volume slightly

      osc.connect(filter);
      filter.connect(gain);
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      
      gain.gain.value = 0.05; // Very quiet base volume
      gain.connect(this.ctx!.destination);
      
      osc.start();
      lfo.start();
      
      this.droneNodes.push(osc, lfo);
      this.gainNodes.push(gain);
    });
  }

  playHeartbeat() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.frequency.setValueAtTime(50, t);
    osc.frequency.exponentialRampToValueAtTime(1, t + 0.5);
    
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(t);
    osc.stop(t + 0.5);

    // Second beat
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.frequency.setValueAtTime(50, t + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(1, t + 0.65);
    gain2.gain.setValueAtTime(0.3, t + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(t + 0.15);
    osc2.stop(t + 0.65);
  }

  playJumpscare() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    // Screeching noise
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.linearRampToValueAtTime(200, t + 0.2);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
    gain.gain.linearRampToValueAtTime(0, t + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  }
}

export const audioManager = new AudioService();