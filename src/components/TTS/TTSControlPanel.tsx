"use client";

import React, { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { appConfig } from '@/lib/config';
import { Volume2, Settings, Zap, Mic, Gauge } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';

interface RefAudioFile {
  name: string;
  path: string;
}

interface TTSControlPanelProps {
  exaggeration: number;
  cfgWeight: number;
  selectedRefAudio: string | null;
  onExaggerationChange: (value: number) => void;
  onCfgWeightChange: (value: number) => void;
  onRefAudioChange: (filename: string | null) => void;
}

// Hardcoded list of high-quality Kokoro voices from VOICES.txt
const KOKORO_VOICES = [
  // US English Voices
  { id: "af_heart", name: "Heart (US Female)", lang: "en-us" },
  { id: "af_bella", name: "Bella (US Female)", lang: "en-us" },
  { id: "af_nicole", name: "Nicole (US Female)", lang: "en-us" },
  { id: "af_sarah", name: "Sarah (US Female)", lang: "en-us" },
  { id: "af_sky", name: "Sky (US Female)", lang: "en-us" },
  { id: "af_alloy", name: "Alloy (US Female)", lang: "en-us" },
  { id: "af_jessica", name: "Jessica (US Female)", lang: "en-us" },
  { id: "af_river", name: "River (US Female)", lang: "en-us" },
  { id: "am_adam", name: "Adam (US Male)", lang: "en-us" },
  { id: "am_michael", name: "Michael (US Male)", lang: "en-us" },
  { id: "am_eric", name: "Eric (US Male)", lang: "en-us" },

  // British English Voices
  { id: "bf_emma", name: "Emma (UK Female)", lang: "en-gb" },
  { id: "bf_isabella", name: "Isabella (UK Female)", lang: "en-gb" },
  { id: "bm_george", name: "George (UK Male)", lang: "en-gb" },
  { id: "bm_lewis", name: "Lewis (UK Male)", lang: "en-gb" },

  // French Voices
  { id: "ff_siwis", name: "Siwis (French Female)", lang: "fr" },

  // Spanish Voices
  { id: "ef_dora", name: "Dora (Spanish Female)", lang: "es" },
  { id: "em_alex", name: "Alex (Spanish Male)", lang: "es" },

  // Japanese Voices
  { id: "jf_alpha", name: "Alpha (Japanese Female)", lang: "ja" },

  // Chinese Voices
  { id: "zf_xiaobei", name: "Xiaobei (Chinese Female)", lang: "zh" },

  // Hindi Voices
  { id: "hf_alpha", name: "Alpha (Hindi Female)", lang: "hi" },

  // Italian Voices
  { id: "if_alpha", name: "Alpha (Italian Female)", lang: "it" },

  // Portuguese Voices
  { id: "pf_alpha", name: "Alpha (Portuguese Female)", lang: "pt" },
];

export function TTSControlPanel({
  exaggeration,
  cfgWeight,
  selectedRefAudio,
  onExaggerationChange,
  onCfgWeightChange,
  onRefAudioChange,
}: TTSControlPanelProps) {
  const {
    ttsProvider,
    setTtsProvider,
    kokoroVoice,
    setKokoroVoice,
    kokoroSpeed,
    setKokoroSpeed
  } = useChat();

  const [refAudioFiles, setRefAudioFiles] = useState<RefAudioFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCachingAudio, setIsCachingAudio] = useState(false);

  // Fetch available reference audio files for Chatterbox
  useEffect(() => {
    const fetchRefAudioFiles = async () => {
      setIsLoadingFiles(true);
      setError(null);
      try {
        const ttsServiceUrl = appConfig.chatterboxTtsUrl || 'http://localhost:7860';
        const response = await fetch(`${ttsServiceUrl}/ref-audio-files`);
        if (!response.ok) {
          throw new Error('Failed to fetch reference audio files');
        }
        const data = await response.json();
        setRefAudioFiles(data.files || []);
      } catch (err) {
        console.error('Error fetching reference audio files:', err);
        // Silent fail for UI cleanliness, logs to console
      } finally {
        setIsLoadingFiles(false);
      }
    };

    if (ttsProvider === 'chatterbox') {
      fetchRefAudioFiles();
    }
  }, [appConfig.chatterboxTtsUrl, ttsProvider]);

  // Cache reference audio when selected (Chatterbox specific)
  const handleRefAudioChange = async (filename: string | null) => {
    onRefAudioChange(filename);

    if (filename && filename !== 'none') {
      setIsCachingAudio(true);
      try {
        const ttsServiceUrl = appConfig.chatterboxTtsUrl || 'http://localhost:7860';
        await fetch(`${ttsServiceUrl}/cache-reference-audio?filename=${encodeURIComponent(filename)}`, {
          method: 'POST',
        });
      } catch (err) {
        console.error('Error caching reference audio:', err);
      } finally {
        setIsCachingAudio(false);
      }
    }
  };

  return (
    <Card className="w-full bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-blue-600" />
          <div>
            <CardTitle className="text-lg">Audio Generation Settings</CardTitle>
            <CardDescription>Configure text-to-speech engine and parameters</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">

        <Tabs defaultValue="chatterbox" value={ttsProvider} onValueChange={(val) => setTtsProvider(val as 'chatterbox' | 'kokoro')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="chatterbox" className="flex items-center gap-2">
              <Mic className="h-4 w-4" /> Chatterbox
            </TabsTrigger>
            <TabsTrigger value="kokoro" className="flex items-center gap-2">
              <Zap className="h-4 w-4" /> Kokoro 82M
            </TabsTrigger>
          </TabsList>

          {/* CHATTERBOX CONTROLS */}
          <TabsContent value="chatterbox" className="space-y-6 animate-in fade-in-50">
            {/* Exaggeration Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">Exaggeration</label>
                <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                  {exaggeration.toFixed(2)}
                </span>
              </div>
              <Slider
                value={[exaggeration]}
                onValueChange={(value) => onExaggerationChange(value[0])}
                min={0.25}
                max={2}
                step={0.05}
                className="w-full"
              />
              <p className="text-xs text-gray-500">Controls speech expressiveness (0.25-2.0, neutral=0.5)</p>
            </div>

            {/* CFG/Pace Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">CFG/Pace Weight</label>
                <span className="text-sm font-semibold text-indigo-600 bg-indigo-100 px-2 py-1 rounded">
                  {cfgWeight.toFixed(2)}
                </span>
              </div>
              <Slider
                value={[cfgWeight]}
                onValueChange={(value) => onCfgWeightChange(value[0])}
                min={0.2}
                max={1}
                step={0.05}
                className="w-full"
              />
              <p className="text-xs text-gray-500">Controls generation guidance and pace (0.2-1.0)</p>
            </div>

            {/* Reference Audio File Selection */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-gray-600" />
                <label className="text-sm font-medium text-gray-700">Reference Audio (Cloning)</label>
              </div>
              <Select
                value={selectedRefAudio || 'none'}
                onValueChange={(value) => handleRefAudioChange(value === 'none' ? null : value)}
                disabled={isLoadingFiles || isCachingAudio}
              >
                <SelectTrigger className="w-full bg-white border-gray-300">
                  <SelectValue placeholder={isLoadingFiles ? 'Loading files...' : 'Select reference audio'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Standard TTS)</SelectItem>
                  {refAudioFiles.map((file) => (
                    <SelectItem key={file.name} value={file.name}>{file.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Select a reference file to clone voice characteristics</p>
            </div>
          </TabsContent>

          {/* KOKORO CONTROLS */}
          <TabsContent value="kokoro" className="space-y-6 animate-in fade-in-50">
            <div className="p-3 bg-green-50 border border-green-200 rounded-md text-xs text-green-800 mb-4">
              <strong>✨ Kokoro 82M:</strong> Ultra-fast inference. Audio is generated in a single batch (not streamed).
            </div>

            {/* Voice Selection */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Volume2 className="h-4 w-4" /> Voice Model
                </label>
              </div>
              <Select value={kokoroVoice} onValueChange={setKokoroVoice}>
                <SelectTrigger className="w-full bg-white border-gray-300">
                  <SelectValue placeholder="Select a voice" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {KOKORO_VOICES.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Select a predefined Kokoro voice style.</p>
            </div>

            {/* Speed Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Gauge className="h-4 w-4" /> Speaking Pace
                </label>
                <span className="text-sm font-semibold text-green-600 bg-green-100 px-2 py-1 rounded">
                  {kokoroSpeed}x
                </span>
              </div>
              <Slider
                value={[kokoroSpeed]}
                onValueChange={(value) => setKokoroSpeed(value[0])}
                min={0.5}
                max={2.0}
                step={0.1}
                className="w-full"
              />
              <p className="text-xs text-gray-500">Adjust the speed of speech generation (0.5x - 2.0x)</p>
            </div>
          </TabsContent>
        </Tabs>

      </CardContent>
    </Card>
  );
}