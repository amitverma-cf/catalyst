"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/trpc/react";
import { useUser } from "@clerk/nextjs";;

interface ResumeUploadProps {
    onAnalysisComplete?: (analysisId: number) => void;
}

export function ResumeUpload({ onAnalysisComplete }: ResumeUploadProps) {
    const [resumeText, setResumeText] = useState("");
    const [jobRole, setJobRole] = useState("");
    const [uploadMethod, setUploadMethod] = useState<"text" | "file">("text");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { user } = useUser();

    const analyzeResumeMutation = api.resume.analyzeResume.useMutation({
        onSuccess: (data) => {
            toast.success("Success!", {
                description: "Resume analyzed successfully",
            });
            setResumeText("");
            setJobRole("");
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            onAnalysisComplete?.(data.analysisId);
        },
        onError: (error) => {
            toast.error(
                "Error", {
                description: error.message
            });
        },
    });

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.type !== "application/pdf") {
            toast.error("Invalid file type", {
                description: "Please select a PDF file",
            });
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            toast.error("File too large", {
                description: "Please select a file smaller than 10MB",
            });
            return;
        }

        setSelectedFile(file);
    };

    const convertFileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user) {
            toast.error("Authentication required", {
                description: "Please sign in to analyze your resume",
            });
            return;
        }

        if (!jobRole.trim()) {
            toast.error("Job role required", {
                description: "Please enter the target job role",
            });
            return;
        }

        if (uploadMethod === "text" && !resumeText.trim()) {
            toast.error("Resume text required", {
                description: "Please enter your resume text",
            });
            return;
        }

        if (uploadMethod === "file" && !selectedFile) {
            toast.error("File required", {
                description: "Please select a PDF file",
            });
            return;
        }

        try {
            let finalResumeText = resumeText;

            if (uploadMethod === "file" && selectedFile) {
                // Convert PDF to base64 for Gemini processing
                const base64Data = await convertFileToBase64(selectedFile);
                // Use JSON format for more reliable parsing
                const fileData = {
                    type: 'PDF_FILE',
                    data: base64Data,
                    fileName: selectedFile.name
                };
                finalResumeText = JSON.stringify(fileData);
            }

            analyzeResumeMutation.mutate({
                resumeText: finalResumeText,
                jobRole: jobRole.trim(),
                userId: user.id,
            });
        } catch (error) {
            toast.error("Error", {
                description: "Failed to process file",
            });
        }
    };

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Resume Analysis
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Job Role Input */}
                    <div className="space-y-2">
                        <Label htmlFor="jobRole">Target Job Role *</Label>
                        <Input
                            id="jobRole"
                            type="text"
                            placeholder="e.g., Software Engineer, Data Scientist, Product Manager"
                            value={jobRole}
                            onChange={(e) => setJobRole(e.target.value)}
                            required
                        />
                    </div>

                    {/* Upload Method Toggle */}
                    <div className="space-y-3">
                        <Label>Upload Method</Label>
                        <div className="flex gap-4">
                            <button
                                type="button"
                                onClick={() => setUploadMethod("text")}
                                className={`px-4 py-2 rounded-lg border transition-colors ${uploadMethod === "text"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-background hover:bg-muted"
                                    }`}
                            >
                                Paste Text
                            </button>
                            <button
                                type="button"
                                onClick={() => setUploadMethod("file")}
                                className={`px-4 py-2 rounded-lg border transition-colors ${uploadMethod === "file"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-background hover:bg-muted"
                                    }`}
                            >
                                Upload PDF
                            </button>
                        </div>
                    </div>

                    {/* Text Input */}
                    {uploadMethod === "text" && (
                        <div className="space-y-2">
                            <Label htmlFor="resumeText">Resume Text *</Label>
                            <Textarea
                                id="resumeText"
                                placeholder="Paste your resume text here..."
                                value={resumeText}
                                onChange={(e) => setResumeText(e.target.value)}
                                rows={12}
                                className="min-h-[300px]"
                                required
                            />
                        </div>
                    )}

                    {/* File Upload */}
                    {uploadMethod === "file" && (
                        <div className="space-y-2">
                            <Label htmlFor="resumeFile">Upload Resume PDF *</Label>
                            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                                <input
                                    ref={fileInputRef}
                                    id="resumeFile"
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <div className="space-y-2">
                                    {selectedFile ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <FileText className="h-5 w-5 text-green-500" />
                                            <span className="text-sm font-medium">{selectedFile.name}</span>
                                        </div>
                                    ) : (
                                        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {selectedFile ? "Change File" : "Select PDF File"}
                                    </Button>
                                    <p className="text-xs text-muted-foreground">
                                        Maximum file size: 10MB
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={analyzeResumeMutation.isPending}
                    >
                        {analyzeResumeMutation.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Analyzing Resume...
                            </>
                        ) : (
                            <>
                                <FileText className="mr-2 h-4 w-4" />
                                Analyze Resume
                            </>
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
