import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});
const config = {
    thinkingConfig: {
        thinkingBudget: -1,
    },
};
const model = 'gemini-2.5-flash';
const contents = [
    {
        role: 'user',
        parts: [
            {
                text: `INSERT_INPUT_HERE`,
            },
        ],
    },
];

export const resumeRouter = createTRPCRouter({
    hello: publicProcedure
        .input(z.object({ text: z.string() }))
        .query(({ input }) => {
            return {
                greeting: `Hello ${input.text}`,
            };
        }),


});
