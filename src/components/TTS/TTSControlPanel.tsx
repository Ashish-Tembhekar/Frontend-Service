"use client";

import React, { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { appConfig } from '@/lib/config';
import { Volume2, Settings } from 'lucide-react';

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

export function TTSControlPanel({
  exaggeration,
  cfgWeight,
  selectedRefAudio,
  onExaggerationChange,
  onCfgWeightChange,
  onRefAudioChange,
}: TTSControlPanelProps) {
  const [refAudioFiles, setRefAudioFiles] = useState<RefAudioFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCachingAudio, setIsCachingAudio] = useState(false);

  // Fetch available reference audio files
  useEffect(() => {
    const fetchRefAudioFiles = async () => {
      setIsLoadingFiles(true);
      setError(null);
      try {
        const ttsServiceUrl = appConfig.chatterboxTtsUrl || 'http://localhost:8000';
        const response = await fetch(`${ttsServiceUrl}/ref-audio-files`);
        if (!response.ok) {
          throw new Error('Failed to fetch reference audio files');
        }
        const data = await response.json();
        setRefAudioFiles(data.files || []);
      } catch (err) {
        console.error('Error fetching reference audio files:', err);
        setError(err instanceof Error ? err.message : 'Failed to load reference audio files');
      } finally {
        setIsLoadingFiles(false);
      }
    };

    fetchRefAudioFiles();
  }, [appConfig.chatterboxTtsUrl]);

  // Cache reference audio when selected
  const handleRefAudioChange = async (filename: string | null) => {
    onRefAudioChange(filename);

    if (filename && filename !== 'none') {
      // Cache the selected audio on the server
      setIsCachingAudio(true);
      try {
        const ttsServiceUrl = appConfig.chatterboxTtsUrl || 'http://localhost:8000';
        const response = await fetch(`${ttsServiceUrl}/cache-reference-audio?filename=${encodeURIComponent(filename)}`, {
          method: 'POST',
        });
        if (!response.ok) {
          console.warn('Failed to cache reference audio on server');
        } else {
          const data = await response.json();
          console.log('✅ Reference audio cached on server:', data.message);
        }
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
            <CardTitle className="text-lg">TTS Controls</CardTitle>
            <CardDescription>Adjust voice synthesis parameters</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Exaggeration Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-gray-700">
              Exaggeration
            </label>
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
          <p className="text-xs text-gray-500">
            Controls speech expressiveness (0.25-2.0, neutral=0.5)
          </p>
        </div>

        {/* CFG/Pace Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-gray-700">
              CFG/Pace Weight
            </label>
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
          <p className="text-xs text-gray-500">
            Controls generation guidance and pace (0.2-1.0, set to 0 for language transfer)
          </p>
        </div>

        {/* Reference Audio File Selection */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-gray-600" />
            <label className="text-sm font-medium text-gray-700">
              Reference Audio (Voice Cloning)
            </label>
          </div>
          <Select
            key={`select-${refAudioFiles.length}`}
            value={selectedRefAudio || 'none'}
            onValueChange={(value) => handleRefAudioChange(value === 'none' ? null : value)}
            disabled={isLoadingFiles || isCachingAudio}
          >
            <SelectTrigger className="w-full bg-white border-gray-300">
              <SelectValue placeholder={isLoadingFiles ? 'Loading files...' : 'Select reference audio'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (Standard TTS)</SelectItem>
              {refAudioFiles && refAudioFiles.length > 0 && refAudioFiles.map((file) => (
                <SelectItem key={file.name} value={file.name}>
                  {file.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
          {refAudioFiles.length === 0 && !isLoadingFiles && !error && (
            <p className="text-xs text-gray-500">
              No reference audio files available. Add .wav, .mp3, .flac, or .ogg files to the tts-service/ref_audio directory.
            </p>
          )}
          <p className="text-xs text-gray-500">
            Select a reference audio file to clone the voice characteristics
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

