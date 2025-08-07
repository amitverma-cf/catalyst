"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  User, 
  Briefcase, 
  GraduationCap, 
  Award, 
  TrendingUp, 
  AlertTriangle,
  Star,
  Clock,
  Building
} from "lucide-react";

interface ResumeAnalysisDisplayProps {
  analysis: {
    id: number;
    jobRole: string;
    resumeText: string;
    skills: any;
    experience: any;
    geminiAnalysis: any;
    createdAt: Date;
  };
}

export function ResumeAnalysisDisplay({ analysis }: ResumeAnalysisDisplayProps) {
  const gemini = analysis.geminiAnalysis;

  // Debug logging
  console.log('Analysis data:', analysis);
  console.log('Gemini analysis:', gemini);
  console.log('Overall score:', gemini?.overallScore);

  // Safely extract data with fallbacks
  const skills = gemini?.skills || [];
  const experience = gemini?.experience || {};
  const education = gemini?.education || {};
  const strengths = gemini?.strengths || [];
  const improvementAreas = gemini?.improvementAreas || [];
  const overallScore = gemini?.overallScore || 0;
  const recommendations = gemini?.recommendations || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Resume Analysis for {analysis.jobRole}
          </CardTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {new Date(analysis.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4" />
              Overall Score: {typeof overallScore === 'number' ? overallScore : 0}/100
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={overallScore} className="w-full" />
        </CardContent>
      </Card>

      {/* Skills Section */}
      {(skills.technical || skills.soft || skills.programming || skills.tools) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Skills Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {skills.technical && (
              <div>
                <h4 className="font-medium mb-2">Technical Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {skills.technical.map((skill: string, index: number) => (
                    <Badge key={index} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {skills.programming && (
              <div>
                <h4 className="font-medium mb-2">Programming Languages</h4>
                <div className="flex flex-wrap gap-2">
                  {skills.programming.map((skill: string, index: number) => (
                    <Badge key={index} variant="outline">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {skills.soft && (
              <div>
                <h4 className="font-medium mb-2">Soft Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {skills.soft.map((skill: string, index: number) => (
                    <Badge key={index} variant="default">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {skills.tools && (
              <div>
                <h4 className="font-medium mb-2">Tools & Technologies</h4>
                <div className="flex flex-wrap gap-2">
                  {skills.tools.map((skill: string, index: number) => (
                    <Badge key={index} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Experience Section */}
      {experience.positions && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Work Experience ({experience.totalYears || 0} years total)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {experience.positions.map((position: any, index: number) => (
              <div key={index} className="border-l-2 border-primary pl-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  <h4 className="font-medium">{position.role}</h4>
                  <span className="text-muted-foreground">at {position.company}</span>
                </div>
                <p className="text-sm text-muted-foreground">{position.duration}</p>
                {position.responsibilities && (
                  <ul className="text-sm space-y-1">
                    {position.responsibilities.map((resp: string, respIndex: number) => (
                      <li key={respIndex} className="list-disc list-inside">
                        {resp}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Education Section */}
      {education.degrees && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Education
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {education.degrees.map((degree: any, index: number) => (
              <div key={index} className="space-y-1">
                <h4 className="font-medium">{degree.degree}</h4>
                <p className="text-sm text-muted-foreground">
                  {degree.institution} • {degree.year}
                </p>
              </div>
            ))}
            {education.certifications && education.certifications.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Certifications</h4>
                <div className="flex flex-wrap gap-2">
                  {education.certifications.map((cert: string, index: number) => (
                    <Badge key={index} variant="outline">
                      {cert}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Strengths and Improvement Areas */}
      <div className="grid md:grid-cols-2 gap-6">
        {strengths.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-5 w-5" />
                Key Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {strengths.map((strength: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-sm">{strength}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {improvementAreas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="h-5 w-5" />
                Areas for Improvement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {improvementAreas.map((area: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-sm">{area}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {recommendations.map((rec: string, index: number) => (
                <li key={index} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <span className="text-sm">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Raw Analysis Fallback */}
      {gemini?.rawAnalysis && !gemini?.skills && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg overflow-auto">
              {gemini.rawAnalysis}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
