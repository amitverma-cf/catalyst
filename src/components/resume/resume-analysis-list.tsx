"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Calendar, 
  Briefcase, 
  Eye, 
  Trash2, 
  Download,
  Star
} from "lucide-react";
import { api } from "@/trpc/react";
import { toast } from "sonner";

interface ResumeAnalysisListProps {
  userId: string;
  onViewAnalysis?: (analysisId: number) => void;
}

export function ResumeAnalysisList({ userId, onViewAnalysis }: ResumeAnalysisListProps) {
  const { data: analyses, isLoading, refetch } = api.resume.getUserAnalyses.useQuery({ userId });

  const deleteAnalysisMutation = api.resume.deleteAnalysis.useMutation({
    onSuccess: () => {
      toast.success("Analysis deleted successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete analysis");
    },
  });

  const handleDelete = (analysisId: number) => {
    if (window.confirm("Are you sure you want to delete this analysis?")) {
      deleteAnalysisMutation.mutate({ analysisId, userId });
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-8">
          <div className="text-center text-muted-foreground">
            Loading your resume analyses...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analyses || analyses.length === 0) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-medium">No Resume Analyses Yet</h3>
              <p className="text-muted-foreground">
                Upload your first resume to get started with AI-powered analysis
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Your Resume Analyses</h2>
        <Badge variant="secondary">{analyses.length} total</Badge>
      </div>

      <div className="space-y-4">
        {analyses.map((analysis) => {
          const gemini = analysis.geminiAnalysis as any;
          const overallScore = gemini?.overallScore || 0;
          const skillsCount = gemini?.skills ? 
            Object.values(gemini.skills).flat().length : 0;

          return (
            <Card key={analysis.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      {analysis.jobRole}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(analysis.createdAt).toLocaleDateString()}
                      </div>
                      {overallScore > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4" />
                          Score: {overallScore}/100
                        </div>
                      )}
                      {skillsCount > 0 && (
                        <Badge variant="outline">
                          {skillsCount} skills identified
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewAnalysis?.(analysis.id)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(analysis.id)}
                      disabled={deleteAnalysisMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {gemini && (
                <CardContent className="pt-0">
                  <Separator className="mb-4" />
                  
                  {/* Quick Preview */}
                  <div className="grid md:grid-cols-3 gap-4">
                    {gemini.strengths && gemini.strengths.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-green-600 mb-2">
                          Key Strengths
                        </h4>
                        <ul className="text-sm space-y-1">
                          {gemini.strengths.slice(0, 2).map((strength: string, index: number) => (
                            <li key={index} className="text-muted-foreground">
                              • {strength.length > 50 ? `${strength.substring(0, 50)}...` : strength}
                            </li>
                          ))}
                          {gemini.strengths.length > 2 && (
                            <li className="text-xs text-muted-foreground">
                              +{gemini.strengths.length - 2} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {gemini.skills?.technical && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Technical Skills</h4>
                        <div className="flex flex-wrap gap-1">
                          {gemini.skills.technical.slice(0, 3).map((skill: string, index: number) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                          {gemini.skills.technical.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{gemini.skills.technical.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {gemini.experience?.totalYears && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Experience</h4>
                        <p className="text-sm text-muted-foreground">
                          {gemini.experience.totalYears} years total
                        </p>
                        {gemini.experience.positions && (
                          <p className="text-xs text-muted-foreground">
                            {gemini.experience.positions.length} position(s)
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Resume Text Preview */}
                  {analysis.resumeText && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-medium mb-2">Resume Preview</h4>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {analysis.resumeText.substring(0, 200)}...
                      </p>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
