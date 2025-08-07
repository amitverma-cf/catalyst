'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { api } from '@/trpc/react';
import { InterviewRoom } from '@/components/interview/interview-room';
import { InterviewSettings } from '@/components/interview/interview-settings';
import { InterviewHistory } from '@/components/interview/interview-history';
import type { InterviewSettings as InterviewSettingsType, ResumeAnalysisDB, InterviewDB, Skills, Experience } from '@/lib/types';

export default function InterviewPage() {
    const { user, isLoaded } = useUser();
    const router = useRouter();
    const [currentView, setCurrentView] = useState<'setup' | 'room' | 'history'>('setup');
    const [interviewId, setInterviewId] = useState<number | null>(null);
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [settings, setSettings] = useState<InterviewSettingsType>({
        jobRole: '',
        voiceName: 'Zephyr',
        languageCode: 'en-US',
        enableVideo: true,
        enableAudio: true,
    });

    // Fetch user's recent resume analysis and interview stats
    const { data: recentAnalysis, isLoading: loadingAnalysis } = api.interview.getRecentResumeAnalysis.useQuery();
    const { data: stats, isLoading: loadingStats } = api.interview.getInterviewStats.useQuery();
    const { data: recentInterviews } = api.interview.getUserInterviews.useQuery({ limit: 5 });

    // Create interview session mutation
    const createSession = api.interview.createEphemeralToken.useMutation({
        onSuccess: (data) => {
            setInterviewId(data.interviewId);
            setSessionToken(data.token || null);
            setCurrentView('room');
            toast.success('Interview session created successfully!');
        },
        onError: (error) => {
            toast.error(`Failed to create interview session: ${error.message}`);
        },
    });

    // Complete interview mutation
    const completeInterview = api.interview.completeInterview.useMutation({
        onSuccess: () => {
            toast.success('Interview completed successfully!');
            setCurrentView('history');
            setInterviewId(null);
            setSessionToken(null);
        },
        onError: (error) => {
            toast.error(`Failed to complete interview: ${error.message}`);
        },
    });

    useEffect(() => {
        if (isLoaded && !user) {
            router.push('/');
        }
    }, [isLoaded, user, router]);

    if (!isLoaded) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!user) {
        return null;
    }

    const handleStartInterview = () => {
        if (!settings.jobRole.trim()) {
            toast.error('Please enter a job role');
            return;
        }

        createSession.mutate({
            jobRole: settings.jobRole,
            resumeAnalysisId: recentAnalysis?.id,
            settings,
        });
    };

    const handleCompleteInterview = (feedback: any) => {
        if (interviewId) {
            completeInterview.mutate({
                interviewId,
                feedback,
            });
        }
    };

    const handleBackToSetup = () => {
        setCurrentView('setup');
        setInterviewId(null);
        setSessionToken(null);
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">AI Interview</h1>
                    <p className="text-muted-foreground">
                        Practice your interview skills with our AI-powered interviewer
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={currentView === 'setup' ? 'default' : 'outline'}
                        onClick={() => setCurrentView('setup')}
                    >
                        New Interview
                    </Button>
                    <Button
                        variant={currentView === 'history' ? 'default' : 'outline'}
                        onClick={() => setCurrentView('history')}
                    >
                        History
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            {!loadingStats && stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Total Interviews</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalInterviews}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Completed</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.completedInterviews}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : 'N/A'}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Separator />

            {/* Main Content */}
            {currentView === 'setup' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Interview Setup */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Interview Setup</CardTitle>
                            <CardDescription>
                                Configure your interview session and start practicing
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                                                         <InterviewSettings
                                 settings={settings}
                                 onSettingsChange={setSettings}
                                 onStartInterview={handleStartInterview}
                                 isLoading={createSession.isPending}
                                 recentAnalysis={recentAnalysis as ResumeAnalysisDB}
                             />
                        </CardContent>
                    </Card>

                    {/* Recent Analysis */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Resume Analysis</CardTitle>
                            <CardDescription>
                                Your latest resume analysis will be used as context
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loadingAnalysis ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                            ) : recentAnalysis ? (
                                <div className="space-y-3">
                                    <div>
                                        <Badge variant="secondary">{recentAnalysis.jobRole}</Badge>
                                    </div>
                                                                         <div className="text-sm text-muted-foreground">
                                         <p>Skills: {(recentAnalysis.skills as Skills)?.technical?.slice(0, 3).join(', ') || 'N/A'}...</p>
                                         <p>Experience: {(recentAnalysis.experience as Experience)?.totalYears || 'N/A'} years</p>
                                     </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No recent resume analysis found. Upload your resume first.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {currentView === 'room' && sessionToken && interviewId && (
                <InterviewRoom
                    token={sessionToken}
                    interviewId={interviewId}
                    settings={settings}
                    onComplete={handleCompleteInterview}
                    onBack={handleBackToSetup}
                />
            )}

                         {currentView === 'history' && (
                 <InterviewHistory
                     interviews={(recentInterviews as InterviewDB[]) || []}
                     onStartNew={() => setCurrentView('setup')}
                 />
             )}
        </div>
    );
}
