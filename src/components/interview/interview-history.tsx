'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Calendar, 
  Clock, 
  Star, 
  MessageSquare, 
  TrendingUp,
  FileText,
  Plus
} from 'lucide-react';
import type { InterviewDB, InterviewFeedbackDB, Skills } from '@/lib/types';

interface InterviewHistoryProps {
  interviews: InterviewDB[];
  onStartNew: () => void;
}

const RATING_COLORS = {
  excellent: 'bg-green-100 text-green-800 border-green-200',
  good: 'bg-blue-100 text-blue-800 border-blue-200',
  average: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  needs_improvement: 'bg-red-100 text-red-800 border-red-200',
};

const RATING_ICONS = {
  excellent: '⭐⭐⭐⭐⭐',
  good: '⭐⭐⭐⭐',
  average: '⭐⭐⭐',
  needs_improvement: '⭐⭐',
};

export function InterviewHistory({ interviews, onStartNew }: InterviewHistoryProps) {
  const [selectedInterview, setSelectedInterview] = useState<typeof interviews[0] | null>(null);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (startedAt: Date, endedAt?: Date | null) => {
    if (!endedAt) return 'In Progress';
    
    const duration = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    const minutes = Math.floor(duration / (1000 * 60));
    const seconds = Math.floor((duration % (1000 * 60)) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getAverageRating = (feedback?: InterviewFeedbackDB | null) => {
    if (!feedback?.skillRatings) return null;
    
    const ratings = Object.values(feedback.skillRatings as Record<string, 'excellent' | 'good' | 'average' | 'needs_improvement'>);
    const ratingValues = { excellent: 4, good: 3, average: 2, needs_improvement: 1 };
    const average = ratings.reduce((sum, rating) => sum + ratingValues[rating as keyof typeof ratingValues], 0) / ratings.length;
    
    return average;
  };

  if (interviews.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Interview History</CardTitle>
          <CardDescription>
            You haven't completed any interviews yet. Start your first interview to see your history here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onStartNew} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Start Your First Interview
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Interview History</h2>
          <p className="text-muted-foreground">
            Review your past interviews and performance
          </p>
        </div>
        <Button onClick={onStartNew}>
          <Plus className="h-4 w-4 mr-2" />
          New Interview
        </Button>
      </div>

      {/* Interview List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interview Cards */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Recent Interviews</h3>
          {interviews.map((interview) => (
            <Card 
              key={interview.id} 
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                selectedInterview?.id === interview.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedInterview(interview)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{interview.jobRole}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {formatDate(interview.startedAt)}
                    </CardDescription>
                  </div>
                  <Badge variant={interview.status === 'completed' ? 'default' : 'secondary'}>
                    {interview.status === 'completed' ? 'Completed' : 'In Progress'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>{formatDuration(interview.startedAt, interview.endedAt)}</span>
                  </div>
                  {interview.feedback && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      <span>{RATING_ICONS[interview.feedback.overallRating]}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Interview Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Interview Details</h3>
          {selectedInterview ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedInterview.jobRole}</CardTitle>
                <CardDescription>
                  {formatDate(selectedInterview.startedAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Status:</span>
                    <Badge variant={selectedInterview.status === 'completed' ? 'default' : 'secondary'} className="ml-2">
                      {selectedInterview.status === 'completed' ? 'Completed' : 'In Progress'}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">Duration:</span>
                    <span className="ml-2">{formatDuration(selectedInterview.startedAt, selectedInterview.endedAt)}</span>
                  </div>
                </div>

                {/* Resume Analysis Context */}
                {selectedInterview.resumeAnalysis && (
                  <div>
                    <h4 className="font-medium mb-2">Resume Context</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm text-muted-foreground">Skills:</span>
                                                 <div className="flex flex-wrap gap-1 mt-1">
                           {(selectedInterview.resumeAnalysis.skills as Skills)?.technical?.slice(0, 3).map((skill: string) => (
                             <Badge key={skill} variant="outline" className="text-xs">
                               {skill}
                             </Badge>
                           ))}
                         </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Feedback */}
                {selectedInterview.feedback && (
                  <div>
                    <h4 className="font-medium mb-2">Feedback</h4>
                    <div className="space-y-3">
                      {/* Overall Rating */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Overall Rating:</span>
                        <Badge className={RATING_COLORS[selectedInterview.feedback.overallRating]}>
                          {selectedInterview.feedback.overallRating}
                        </Badge>
                      </div>

                      {/* Skill Ratings */}
                      {selectedInterview.feedback.skillRatings && (
                        <div>
                          <span className="text-sm font-medium">Skill Ratings:</span>
                          <div className="grid grid-cols-1 gap-2 mt-2">
                                                         {Object.entries(selectedInterview.feedback.skillRatings as Record<string, 'excellent' | 'good' | 'average' | 'needs_improvement'>).map(([skill, rating]) => (
                               <div key={skill} className="flex items-center justify-between">
                                 <span className="text-sm capitalize">{skill}:</span>
                                 <Badge variant="outline" className="text-xs">
                                   {rating}
                                 </Badge>
                               </div>
                             ))}
                          </div>
                        </div>
                      )}

                      {/* Strengths & Improvements */}
                      {selectedInterview.feedback.strengths && (
                        <div>
                          <span className="text-sm font-medium text-green-700">Strengths:</span>
                          <p className="text-sm text-muted-foreground mt-1">
                            {selectedInterview.feedback.strengths}
                          </p>
                        </div>
                      )}

                      {selectedInterview.feedback.improvements && (
                        <div>
                          <span className="text-sm font-medium text-orange-700">Areas for Improvement:</span>
                          <p className="text-sm text-muted-foreground mt-1">
                            {selectedInterview.feedback.improvements}
                          </p>
                        </div>
                      )}

                      {/* Summary */}
                      {selectedInterview.feedback.summary && (
                        <div>
                          <span className="text-sm font-medium">Summary:</span>
                          <p className="text-sm text-muted-foreground mt-1">
                            {selectedInterview.feedback.summary}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* No Feedback */}
                {!selectedInterview.feedback && selectedInterview.status === 'completed' && (
                  <div className="text-center py-4 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No feedback available for this interview</p>
                  </div>
                )}

                {/* In Progress */}
                {selectedInterview.status === 'in_progress' && (
                  <div className="text-center py-4 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">This interview is still in progress</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
                <div className="text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Select an interview to view details</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Statistics */}
      {interviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Interview Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{interviews.length}</div>
                <div className="text-sm text-muted-foreground">Total Interviews</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {interviews.filter(i => i.status === 'completed').length}
                </div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {interviews.filter(i => i.feedback?.overallRating === 'excellent' || i.feedback?.overallRating === 'good').length}
                </div>
                <div className="text-sm text-muted-foreground">Good+ Ratings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {interviews.filter(i => i.status === 'completed').length > 0 
                    ? Math.round(interviews.filter(i => i.status === 'completed').length / interviews.length * 100)
                    : 0}%
                </div>
                <div className="text-sm text-muted-foreground">Completion Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 