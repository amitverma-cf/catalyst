'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { InterviewSettings, ResumeAnalysisDB, Skills, Experience } from '@/lib/types';

interface InterviewSettingsProps {
  settings: InterviewSettings;
  onSettingsChange: (settings: InterviewSettings) => void;
  onStartInterview: () => void;
  isLoading: boolean;
  recentAnalysis?: ResumeAnalysisDB | null;
}

const VOICE_OPTIONS = [
  { value: 'Zephyr', label: 'Zephyr (Professional)' },
  { value: 'Kore', label: 'Kore (Friendly)' },
  { value: 'Puck', label: 'Puck (Energetic)' },
  { value: 'Charon', label: 'Charon (Calm)' },
  { value: 'Fenrir', label: 'Fenrir (Authoritative)' },
  { value: 'Aoede', label: 'Aoede (Warm)' },
  { value: 'Leda', label: 'Leda (Clear)' },
  { value: 'Orus', label: 'Orus (Confident)' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-IN', label: 'English (India)' },
  { value: 'es-US', label: 'Spanish (US)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'de-DE', label: 'German (Germany)' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'ja-JP', label: 'Japanese (Japan)' },
  { value: 'ko-KR', label: 'Korean (South Korea)' },
  { value: 'zh-CN', label: 'Chinese (Mandarin)' },
];

export function InterviewSettings({
  settings,
  onSettingsChange,
  onStartInterview,
  isLoading,
  recentAnalysis,
}: InterviewSettingsProps) {
  const [jobRole, setJobRole] = useState(settings.jobRole);

  const handleJobRoleChange = (value: string) => {
    setJobRole(value);
    onSettingsChange({ ...settings, jobRole: value });
  };

  const handleVoiceChange = (value: string) => {
    onSettingsChange({ ...settings, voiceName: value });
  };

  const handleLanguageChange = (value: string) => {
    onSettingsChange({ ...settings, languageCode: value });
  };

  const handleVideoToggle = (enabled: boolean) => {
    onSettingsChange({ ...settings, enableVideo: enabled });
  };

  const handleAudioToggle = (enabled: boolean) => {
    onSettingsChange({ ...settings, enableAudio: enabled });
  };


  return (
    <div className="space-y-6">
      {/* Job Role */}
      <div className="space-y-2">
        <Label htmlFor="job-role">Job Role / Position</Label>
        <div className="flex gap-2">
          <Input
            id="job-role"
            placeholder="e.g., Software Engineer, Product Manager, Data Scientist"
            value={jobRole}
            onChange={(e) => handleJobRoleChange(e.target.value)}
            className="flex-1"
          />
          {recentAnalysis?.jobRole && jobRole !== recentAnalysis.jobRole && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleJobRoleChange(recentAnalysis.jobRole)}
            >
              Use Recent
            </Button>
          )}
        </div>
        {recentAnalysis?.jobRole && (
          <p className="text-xs text-muted-foreground">
            Recent analysis: <Badge variant="secondary">{recentAnalysis.jobRole}</Badge>
          </p>
        )}
      </div>

      {/* Voice Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="voice">AI Voice</Label>
          <Select value={settings.voiceName} onValueChange={handleVoiceChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a voice" />
            </SelectTrigger>
            <SelectContent>
              {VOICE_OPTIONS.map((voice) => (
                <SelectItem key={voice.value} value={voice.value}>
                  {voice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="language">Language</Label>
          <Select value={settings.languageCode} onValueChange={handleLanguageChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((language) => (
                <SelectItem key={language.value} value={language.value}>
                  {language.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Media Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Media Settings</CardTitle>
          <CardDescription>
            Configure audio and video options for your interview
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="audio-toggle">Enable Audio</Label>
              <p className="text-sm text-muted-foreground">
                Allow the AI to speak and hear your responses
              </p>
            </div>
            <Switch
              id="audio-toggle"
              checked={settings.enableAudio}
              onCheckedChange={handleAudioToggle}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="video-toggle">Enable Video</Label>
              <p className="text-sm text-muted-foreground">
                Use webcam for face-to-face interview experience
              </p>
            </div>
            <Switch
              id="video-toggle"
              checked={settings.enableVideo}
              onCheckedChange={handleVideoToggle}
            />
          </div>
        </CardContent>
      </Card>

      {/* Recent Analysis Context */}
      {recentAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Interview Context</CardTitle>
            <CardDescription>
              Your resume analysis will provide context for the interview
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Skills</Label>
                                 <div className="flex flex-wrap gap-1 mt-1">
                   {(recentAnalysis.skills as unknown as Skills)?.technical?.slice(0, 5).map((skill: string) => (
                     <Badge key={skill} variant="outline" className="text-xs">
                       {skill}
                     </Badge>
                   ))}
                 </div>
              </div>
                             <div>
                 <Label className="text-sm font-medium">Experience</Label>
                 <p className="text-sm text-muted-foreground">
                   {(recentAnalysis.experience as unknown as Experience)?.totalYears} years of experience
                 </p>
               </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Start Button */}
      <Button
        onClick={onStartInterview}
        disabled={isLoading || !jobRole.trim()}
        className="w-full"
        size="lg"
      >
        {isLoading ? (
          <>
            <Skeleton className="h-4 w-4 mr-2" />
            Creating Interview Session...
          </>
        ) : (
          'Start Interview'
        )}
      </Button>
    </div>
  );
} 