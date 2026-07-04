import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private getModel() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new ServiceUnavailableException('GEMINI_API_KEY not configured');
    const genAI = new GoogleGenerativeAI(key);
    return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  private async generate(prompt: string): Promise<string> {
    const model = this.getModel();
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  async generateNotice(topic: string, targetAudience: string, tone = 'formal') {
    const prompt = `Write a school notice for a Nepal school.
Topic: ${topic}
Audience: ${targetAudience}
Tone: ${tone}
Format: Write only the title on the very first line (no label, no asterisks, just the title text), then a blank line, then the body content.
Keep it under 150 words. Professional and suitable for a school notice board.`;
    const text = await this.generate(prompt);
    const lines = text.trim().split('\n');
    const title = lines[0].replace(/^#+\s*/, '').replace(/\*+/g, '').trim();
    const content = lines.slice(lines[1]?.trim() === '' ? 2 : 1).join('\n').trim();
    return { title, content };
  }

  async generateReportComment(studentName: string, examResults: any[]) {
    const resultsText = examResults
      .map(r => `${r.subjectName ?? r.subject ?? 'Subject'}: ${r.marksObtained}/${r.totalMarks}${r.grade ? ` (${r.grade})` : ''}`)
      .join(', ');
    const prompt = `Write a teacher's remark for a Nepal school report card.
Student: ${studentName}
Results: ${resultsText}
Write 2-3 sentences. Be encouraging but honest. Mention strongest subject if notable. Keep it professional, suitable for a school report card. Do not use bullet points.`;
    const text = await this.generate(prompt);
    return { comment: text.trim() };
  }

  async getClassInsights(classData: any) {
    const prompt = `Analyze this Nepal school class data and give 3-5 concise bullet point insights for the teacher.
Data: ${JSON.stringify(classData)}
Focus on: attendance trends, at-risk students (low attendance or low marks), fee defaulters, performance patterns.
Format: each insight on its own line starting with "• ". Be specific and actionable. No headers or extra text.`;
    const text = await this.generate(prompt);
    const insights = text
      .trim()
      .split('\n')
      .map(l => l.replace(/^[•\-\*]\s*/, '').trim())
      .filter(Boolean);
    return { insights };
  }

  async generateFeeReminder(studentName: string, guardianName: string, month: string, amountDue: number, daysOverdue: number) {
    const prompt = `Write a polite fee reminder message for a Nepal school.
Student: ${studentName}
Guardian: ${guardianName}
Month: ${month}
Amount due: Rs.${amountDue}
Overdue by: ${daysOverdue} days
Keep it under 100 words. Polite but firm. Ready to read out or send via SMS. No placeholders or brackets in the output.`;
    const text = await this.generate(prompt);
    return { message: text.trim() };
  }

  async generateHomeworkDescription(subject: string, topic: string, className: string, dueDate: string) {
    const prompt = `Write a clear homework assignment description for Nepal school students.
Subject: ${subject}
Topic: ${topic}
Class: ${className}
Due: ${dueDate}
Include what to do, how to submit, and estimated time. Keep it under 80 words. Clear and student-friendly. No bullet points.`;
    const text = await this.generate(prompt);
    return { description: text.trim() };
  }
}
