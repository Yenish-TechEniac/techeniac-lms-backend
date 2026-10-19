import { z } from 'zod';
import express from 'express';

export const app = express();
export const schema = z.string();
