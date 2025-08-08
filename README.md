# [cite_start]AI Interview Coach [cite: 1]

[cite_start]*Interview Preparation with Generative AI* [cite: 2]
Project for UniHack 2025 - GenAI Theme
[cite_start]Team: Catalysts [cite: 3]

---

## 🚀 About The Project

[cite_start]Every student and professional has felt the anxiety before a job interview[cite: 4]. [cite_start]While you can google common questions, you never truly get to practice in a realistic environment[cite: 5]. [cite_start]This project was born from a simple idea: What if you had a personal coach that knew your resume, understood the job you were applying for, and gave you real-time feedback? [cite: 8]

AI Interview Coach is a web application designed to be that coach. It leverages the power of Google's Gemini to provide a hyper-personalized, on-demand interview practice experience. Our platform helps you build confidence and polish your answers, making sure you're ready for the real thing.

### The Problem It Solves

We identified several critical gaps in the current interview preparation landscape:
* [cite_start]*Lack of Personalization:* Most prep tools are generic and don't tailor advice to your specific background[cite: 13].
* [cite_start]*No Delivery Feedback:* You rarely get feedback on how you speak, including your tone and clarity[cite: 14].
* [cite_start]*Prohibitively Expensive:* Professional mock interviews can cost between ₹8k-20k per session, making them inaccessible for many[cite: 15].
* [cite_start]*Not Available On-Demand:* You can't practice whenever you need to, especially for last-minute interviews[cite: 16].

[cite_start]Our platform addresses these challenges by providing a solution that combines realism, personalization, and advanced Generative AI[cite: 17].

## ✨ Features

* [cite_start]*Resume Intelligence:* Upload or paste your resume, and our tool will parse it to extract key skills and identify potential gaps to address[cite: 71].
* [cite_start]*Role-Aware AI:* Powered by Gemini, the coach generates custom interview questions based on the specific job role you select and the contents of your resume[cite: 72].
* *Voice Feedback Engine:* Answer questions naturally using your voice. [cite_start]The AI provides instant, actionable tips on your content, tone, and delivery to help you improve[cite: 73, 74].
* [cite_start]*Post-Interview Analysis:* Receive a comprehensive summary and analysis after your practice session is complete[cite: 84].

## ⚙ Tech Stack

This project is built with a modern, type-safe, and performant technology stack:

* *Frontend:* Next.js, React.js
* *Styling:* Tailwind CSS, shadcn/ui
* *Backend & API:* tRPC (for end-to-end typesafe APIs)
* *Authentication:* Clerk
* *Database:* Postgres (hosted on Neon.tech)
* *Generative AI:* Google's Gemini (@google/genai)

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

Make sure you have Node.js and npm (or yarn/pnpm) installed on your machine.

### Installation

1.  *Clone the repo*
    sh
    git clone [https://github.com/your-username/ai-interview-coach.git](https://github.com/your-username/ai-interview-coach.git)
    cd ai-interview-coach
    
2.  *Install NPM packages*
    sh
    npm install
    
3.  *Set up environment variables*
    Create a .env.local file in the root of the project and add the necessary environment variables. You will need keys for Clerk, your Neon Postgres database, and the Google Gemini API.
    env
    # Clerk Authentication
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
    CLERK_SECRET_KEY=

    # Neon.tech Postgres Database
    DATABASE_URL=

    # Google Gemini API
    GOOGLE_GENAI_API_KEY=
    
4.  *Run the development server*
    sh
    npm run dev
    
    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🗺 User Flow

The application provides two primary workflows:

1.  *Resume Analysis Flow:*
    * Login to the application.
    * Navigate to the /resume page.
    * Select your target job role.
    * Upload or copy-paste your resume into the text area.
    * [cite_start]Receive an instant, AI-powered analysis of your resume[cite: 84].

2.  *Interview Practice Flow:*
    * Login to the application.
    * Navigate to the /interview page.
    * Select the job role you want to practice for.
    * Start the voice-based interview session.
    * [cite_start]After the interview, receive a detailed analysis of your performance[cite: 84].

## 🔮 Future Improvements

We have a clear vision for extending the capabilities of the AI Interview Coach:
* *Deeper Analytics:* Integrate video analysis to provide feedback on body language and eye contact.
* *Expanded Role Library:* Add specialized question banks for more industries like finance, marketing, and healthcare.
* *Company-Specific Training:* Allow users to select a target company, and the AI will tailor questions to that company's specific culture and interview style.
* *Mobile App:* Create a dedicated mobile application for practicing on the go.

## 📄 License

Distributed under the MIT License. See LICENSE.txt for more information.