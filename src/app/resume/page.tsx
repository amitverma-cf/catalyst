"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResumeUpload } from "@/components/resume/resume-upload";
import { ResumeAnalysisList } from "@/components/resume/resume-analysis-list";
import { ResumeAnalysisDisplay } from "@/components/resume/resume-analysis-display";
import { api } from "@/trpc/react";
import { FileText, Upload, History } from "lucide-react";

export default function ResumePage() {
  const { user, isLoaded } = useUser();
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("upload");

  const { data: selectedAnalysis } = api.resume.getAnalysis.useQuery(
    { analysisId: selectedAnalysisId! },
    { enabled: !!selectedAnalysisId }
  );

  if (!isLoaded) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Resume Analysis</h1>
            <p className="text-muted-foreground">
              Sign in to analyze your resume with AI-powered insights
            </p>
          </div>
          <FileText className="h-24 w-24 mx-auto text-muted-foreground" />
          <div className="space-y-4 max-w-md mx-auto">
            <p className="text-sm text-muted-foreground">
              Get detailed analysis of your resume including:
            </p>
            <ul className="text-sm text-left space-y-2">
              <li>• Skills identification and categorization</li>
              <li>• Experience analysis and gap identification</li>
              <li>• Tailored recommendations for specific job roles</li>
              <li>• Overall resume scoring and feedback</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const handleAnalysisComplete = (analysisId: number) => {
    setSelectedAnalysisId(analysisId);
    setActiveTab("view");
  };

  const handleViewAnalysis = (analysisId: number) => {
    setSelectedAnalysisId(analysisId);
    setActiveTab("view");
  };

  const handleBackToList = () => {
    setSelectedAnalysisId(null);
    setActiveTab("history");
  };

  if (selectedAnalysis && activeTab === "view") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="outline" onClick={handleBackToList}>
            ← Back to Analyses
          </Button>
        </div>
        <ResumeAnalysisDisplay analysis={selectedAnalysis} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Resume Analysis</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Get AI-powered insights on your resume. Upload your resume or paste the text, 
            and our advanced AI will provide detailed analysis and recommendations.
          </p>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              New Analysis
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Past Analyses
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-8">
            <ResumeUpload onAnalysisComplete={handleAnalysisComplete} />
          </TabsContent>

          <TabsContent value="history" className="mt-8">
            <ResumeAnalysisList userId={user.id} onViewAnalysis={handleViewAnalysis} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
