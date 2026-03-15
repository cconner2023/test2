export interface VoiceRecordingResult {
  blob: Blob
  duration: number
  waveform: number[]
  mime: string
}

interface RecordingController {
  stop(): Promise<VoiceRecordingResult>
  cancel(): void
  getAmplitude(): number
}

const WAVEFORM_SAMPLES = 48
const SAMPLE_RATE_HZ = 15

function selectMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ]
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return ''
}

function downsampleWaveform(raw: number[]): number[] {
  if (raw.length === 0) return new Array(WAVEFORM_SAMPLES).fill(0)
  if (raw.length <= WAVEFORM_SAMPLES) {
    return raw.map((v) => Math.round(v * 100) / 100)
  }

  const result: number[] = []
  const step = raw.length / WAVEFORM_SAMPLES

  for (let i = 0; i < WAVEFORM_SAMPLES; i++) {
    const start = Math.floor(i * step)
    const end = Math.floor((i + 1) * step)
    let sum = 0
    for (let j = start; j < end; j++) sum += raw[j]
    result.push(Math.round((sum / (end - start)) * 100) / 100)
  }

  return result
}

function normalizeWaveform(samples: number[]): number[] {
  const max = Math.max(...samples)
  if (max === 0) return samples
  return samples.map((v) => Math.round((v / max) * 100) / 100)
}

export async function startRecording(): Promise<RecordingController> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

  const mime = selectMimeType()
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)

  const audioCtx = new AudioContext()
  const source = audioCtx.createMediaStreamSource(stream)
  const analyser = audioCtx.createAnalyser()
  analyser.fftSize = 256
  source.connect(analyser)

  const timeDomainData = new Uint8Array(analyser.fftSize)
  const rawAmplitudes: number[] = []
  const startTime = Date.now()
  let lastSampleTime = 0
  let animFrameId = 0
  let cancelled = false

  const computeRms = (): number => {
    analyser.getByteTimeDomainData(timeDomainData)
    let sum = 0
    for (let i = 0; i < timeDomainData.length; i++) {
      const normalized = (timeDomainData[i] - 128) / 128
      sum += normalized * normalized
    }
    return Math.sqrt(sum / timeDomainData.length)
  }

  const sampleInterval = 1000 / SAMPLE_RATE_HZ

  const sampleLoop = (): void => {
    if (cancelled) return
    const now = Date.now()
    if (now - lastSampleTime >= sampleInterval) {
      rawAmplitudes.push(computeRms())
      lastSampleTime = now
    }
    animFrameId = requestAnimationFrame(sampleLoop)
  }

  const cleanup = (): void => {
    cancelAnimationFrame(animFrameId)
    stream.getTracks().forEach((t) => t.stop())
    source.disconnect()
    void audioCtx.close()
  }

  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  recorder.start()
  lastSampleTime = Date.now()
  animFrameId = requestAnimationFrame(sampleLoop)

  return {
    stop() {
      return new Promise<VoiceRecordingResult>((resolve, reject) => {
        if (cancelled) {
          reject(new Error('Recording was cancelled'))
          return
        }

        recorder.onstop = () => {
          cleanup()
          const duration = (Date.now() - startTime) / 1000
          const blob = new Blob(chunks, { type: recorder.mimeType })
          const downsampled = downsampleWaveform(rawAmplitudes)
          const waveform = normalizeWaveform(downsampled)

          resolve({ blob, duration, waveform, mime: recorder.mimeType })
        }

        recorder.onerror = () => {
          cleanup()
          reject(new Error('MediaRecorder error during stop'))
        }

        recorder.stop()
      })
    },

    cancel() {
      cancelled = true
      recorder.stop()
      cleanup()
    },

    getAmplitude: computeRms,
  }
}
