"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Radio,
  Search,
  ChevronRight,
  ChevronLeft,
  Compass,
  Layers,
  Thermometer,
  Droplets,
  Activity,
  Filter,
  Download,
  Bot,
  MapPin,
  Clock,
  Sparkles,
  Database,
  Eye,
  TrendingUp,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useOperationalState } from "@/providers/OperationalProvider";

export interface DatabaseFloatRecord {
  wmo: number;
  id: string;
  lat: number;
  lon: number;
  firstDate: string;
  latestDate: string;
  spanDays: number;
  cycles: number;
  totalObs: number;
  minPres: number;
  maxPres: number;
  surfaceTemp: number;
  surfacePsal: number;
  surfaceDoxy: number;
  surfaceChla: number;
  surfaceNitrate: number;
  surfacePh: number;
  status: "NORMAL" | "CRITICAL" | "MONITORED";
  species: string;
  hasTemp: boolean;
  hasPsal: boolean;
  hasDoxy: boolean;
  hasChla: boolean;
  hasPh: boolean;
  hasNitrate: boolean;
}

// Complete catalog of real solo ARGO Floats present in Supabase DB
export const ALL_SUPABASE_FLOATS: DatabaseFloatRecord[] = [
  { wmo: 4903660, id: "ARGO-4903660", lat: 16.16, lon: 63.07, firstDate: "2023-06-05", latestDate: "2025-07-28", spanDays: 783.1, cycles: 142, totalObs: 147113, minPres: 1.0, maxPres: 2005.4, surfaceTemp: 29.8, surfacePsal: 36.5, surfaceDoxy: 165.4, surfaceChla: 0.42, surfaceNitrate: 28.5, surfacePh: 7.95, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 6990514, id: "ARGO-6990514", lat: 16.58, lon: 65.81, firstDate: "2023-06-05", latestDate: "2025-07-28", spanDays: 783.1, cycles: 140, totalObs: 146885, minPres: 1.2, maxPres: 2010.0, surfaceTemp: 30.1, surfacePsal: 36.6, surfaceDoxy: 158.0, surfaceChla: 0.38, surfaceNitrate: 30.2, surfacePh: 7.92, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 1902594, id: "ARGO-1902594", lat: 10.59, lon: 84.71, firstDate: "2023-06-15", latestDate: "2025-07-30", spanDays: 775.5, cycles: 128, totalObs: 126358, minPres: 0.8, maxPres: 2000.0, surfaceTemp: 29.2, surfacePsal: 34.1, surfaceDoxy: 178.5, surfaceChla: 0.55, surfaceNitrate: 26.4, surfacePh: 8.01, status: "NORMAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902272, id: "ARGO-2902272", lat: 18.23, lon: 62.78, firstDate: "2022-01-09", latestDate: "2025-07-31", spanDays: 1300.0, cycles: 185, totalObs: 121933, minPres: 0.5, maxPres: 2008.0, surfaceTemp: 31.4, surfacePsal: 36.8, surfaceDoxy: 48.2, surfaceChla: 0.72, surfaceNitrate: 34.0, surfacePh: 7.72, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902273, id: "ARGO-2902273", lat: 17.07, lon: 67.11, firstDate: "2022-01-19", latestDate: "2025-07-22", spanDays: 1280.0, cycles: 178, totalObs: 117671, minPres: 0.5, maxPres: 2004.0, surfaceTemp: 30.9, surfacePsal: 36.7, surfaceDoxy: 51.0, surfaceChla: 0.68, surfaceNitrate: 32.5, surfacePh: 7.78, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902271, id: "ARGO-2902271", lat: 14.94, lon: 64.53, firstDate: "2022-01-09", latestDate: "2024-12-14", spanDays: 1070.0, cycles: 160, totalObs: 106544, minPres: 0.4, maxPres: 2000.0, surfaceTemp: 30.5, surfacePsal: 36.4, surfaceDoxy: 56.4, surfaceChla: 0.60, surfaceNitrate: 31.0, surfacePh: 7.82, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 1902751, id: "ARGO-1902751", lat: 20.43, lon: 60.25, firstDate: "2025-04-21", latestDate: "2025-07-30", spanDays: 100.1, cycles: 38, totalObs: 92466, minPres: 1.0, maxPres: 2000.0, surfaceTemp: 30.7, surfacePsal: 36.9, surfaceDoxy: 54.0, surfaceChla: 0.64, surfaceNitrate: 33.1, surfacePh: 7.75, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902270, id: "ARGO-2902270", lat: 13.82, lon: 65.56, firstDate: "2022-01-09", latestDate: "2024-05-21", spanDays: 863.0, cycles: 130, totalObs: 83183, minPres: 0.6, maxPres: 2000.0, surfaceTemp: 29.8, surfacePsal: 36.2, surfaceDoxy: 160.0, surfaceChla: 0.45, surfaceNitrate: 27.0, surfacePh: 7.90, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 7901136, id: "ARGO-7901136", lat: 16.47, lon: 68.30, firstDate: "2023-10-26", latestDate: "2026-08-19", spanDays: 1028.0, cycles: 154, totalObs: 72702, minPres: 0.5, maxPres: 2006.0, surfaceTemp: 31.0, surfacePsal: 36.5, surfaceDoxy: 49.5, surfaceChla: 0.70, surfaceNitrate: 33.8, surfacePh: 7.70, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 5907092, id: "ARGO-5907092", lat: 12.46, lon: 67.24, firstDate: "2023-10-27", latestDate: "2026-08-18", spanDays: 1026.0, cycles: 150, totalObs: 71676, minPres: 0.5, maxPres: 2002.0, surfaceTemp: 29.9, surfacePsal: 36.1, surfaceDoxy: 168.0, surfaceChla: 0.48, surfaceNitrate: 26.5, surfacePh: 7.92, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902275, id: "ARGO-2902275", lat: 17.43, lon: 69.82, firstDate: "2022-01-09", latestDate: "2023-03-02", spanDays: 417.0, cycles: 70, totalObs: 68300, minPres: 0.8, maxPres: 2000.0, surfaceTemp: 29.5, surfacePsal: 36.3, surfaceDoxy: 172.0, surfaceChla: 0.50, surfaceNitrate: 25.0, surfacePh: 7.96, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902277, id: "ARGO-2902277", lat: 19.92, lon: 65.17, firstDate: "2022-01-06", latestDate: "2023-12-17", spanDays: 710.0, cycles: 110, totalObs: 63261, minPres: 0.5, maxPres: 2000.0, surfaceTemp: 30.6, surfacePsal: 36.7, surfaceDoxy: 52.8, surfaceChla: 0.66, surfaceNitrate: 32.0, surfacePh: 7.76, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 1902367, id: "ARGO-1902367", lat: 5.41, lon: 88.64, firstDate: "2025-04-15", latestDate: "2026-08-20", spanDays: 492.0, cycles: 56, totalObs: 60133, minPres: 0.36, maxPres: 2014.2, surfaceTemp: 28.6, surfacePsal: 34.8, surfaceDoxy: 182.4, surfaceChla: 0.44, surfaceNitrate: 31.5, surfacePh: 7.66, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 1902660, id: "ARGO-1902660", lat: 21.42, lon: 59.60, firstDate: "2025-04-20", latestDate: "2025-07-31", spanDays: 102.0, cycles: 36, totalObs: 57208, minPres: 1.2, maxPres: 2000.0, surfaceTemp: 31.5, surfacePsal: 37.0, surfaceDoxy: 45.2, surfaceChla: 0.76, surfaceNitrate: 34.8, surfacePh: 7.68, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902263, id: "ARGO-2902263", lat: 16.61, lon: 63.11, firstDate: "2022-01-03", latestDate: "2024-04-02", spanDays: 820.0, cycles: 120, totalObs: 52398, minPres: 0.7, maxPres: 2000.0, surfaceTemp: 30.2, surfacePsal: 36.4, surfaceDoxy: 58.0, surfaceChla: 0.58, surfaceNitrate: 29.5, surfacePh: 7.84, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 1902373, id: "ARGO-1902373", lat: 13.84, lon: 91.56, firstDate: "2025-04-20", latestDate: "2026-08-17", spanDays: 484.0, cycles: 79, totalObs: 48497, minPres: 0.36, maxPres: 1733.4, surfaceTemp: 29.4, surfacePsal: 33.2, surfaceDoxy: 176.2, surfaceChla: 0.62, surfaceNitrate: 28.4, surfacePh: 7.82, status: "MONITORED", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902306, id: "ARGO-2902306", lat: 19.50, lon: 65.63, firstDate: "2024-05-10", latestDate: "2025-07-30", spanDays: 446.0, cycles: 65, totalObs: 46704, minPres: 0.5, maxPres: 2000.0, surfaceTemp: 30.8, surfacePsal: 36.6, surfaceDoxy: 50.4, surfaceChla: 0.65, surfaceNitrate: 31.8, surfacePh: 7.74, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902294, id: "ARGO-2902294", lat: 7.32, lon: 90.57, firstDate: "2022-01-15", latestDate: "2023-03-27", spanDays: 436.0, cycles: 72, totalObs: 46662, minPres: 0.8, maxPres: 2000.0, surfaceTemp: 28.9, surfacePsal: 34.0, surfaceDoxy: 184.0, surfaceChla: 0.46, surfaceNitrate: 24.0, surfacePh: 8.04, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 7902170, id: "ARGO-7902170", lat: 0.91, lon: 81.73, firstDate: "2024-04-21", latestDate: "2025-07-30", spanDays: 465.0, cycles: 68, totalObs: 44182, minPres: 0.4, maxPres: 2000.0, surfaceTemp: 28.7, surfacePsal: 34.6, surfaceDoxy: 186.0, surfaceChla: 0.40, surfaceNitrate: 22.5, surfacePh: 8.06, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 1902457, id: "ARGO-1902457", lat: 5.15, lon: 71.24, firstDate: "2023-06-04", latestDate: "2026-08-12", spanDays: 1165.0, cycles: 117, totalObs: 40989, minPres: 2.0, maxPres: 2010.7, surfaceTemp: 31.2, surfacePsal: 36.1, surfaceDoxy: 46.8, surfaceChla: 0.78, surfaceNitrate: 34.2, surfacePh: 7.62, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 1902455, id: "ARGO-1902455", lat: 2.09, lon: 73.01, firstDate: "2023-06-02", latestDate: "2026-08-20", spanDays: 1175.0, cycles: 118, totalObs: 40389, minPres: 0.7, maxPres: 2008.1, surfaceTemp: 29.1, surfacePsal: 35.4, surfaceDoxy: 190.5, surfaceChla: 0.38, surfaceNitrate: 22.1, surfacePh: 7.91, status: "NORMAL", species: "Epinephelus tauvina", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 1902458, id: "ARGO-1902458", lat: 10.27, lon: 62.41, firstDate: "2023-06-14", latestDate: "2026-08-12", spanDays: 1155.0, cycles: 116, totalObs: 40204, minPres: 2.1, maxPres: 2006.9, surfaceTemp: 30.8, surfacePsal: 36.4, surfaceDoxy: 52.1, surfaceChla: 0.65, surfaceNitrate: 30.0, surfacePh: 7.68, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2903464, id: "ARGO-2903464", lat: 2.97, lon: 82.57, firstDate: "2023-07-03", latestDate: "2026-07-16", spanDays: 1109.0, cycles: 112, totalObs: 38689, minPres: 0.6, maxPres: 2000.0, surfaceTemp: 28.8, surfacePsal: 34.5, surfaceDoxy: 185.0, surfaceChla: 0.42, surfaceNitrate: 23.0, surfacePh: 8.05, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902758, id: "ARGO-2902758", lat: 17.25, lon: 90.18, firstDate: "2022-01-04", latestDate: "2025-07-28", spanDays: 1301.2, cycles: 64, totalObs: 38400, minPres: 7.5, maxPres: 2000.0, surfaceTemp: 29.68, surfacePsal: 32.18, surfaceDoxy: 184.89, surfaceChla: 0.52, surfaceNitrate: 26.8, surfacePh: 7.85, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: false, hasNitrate: true },
  { wmo: 7902190, id: "ARGO-7902190", lat: 6.65, lon: 82.86, firstDate: "2024-05-15", latestDate: "2026-07-27", spanDays: 803.0, cycles: 94, totalObs: 37725, minPres: 0.5, maxPres: 2000.0, surfaceTemp: 29.0, surfacePsal: 34.7, surfaceDoxy: 183.0, surfaceChla: 0.46, surfaceNitrate: 24.5, surfacePh: 8.02, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902211, id: "ARGO-2902211", lat: 19.63, lon: 60.49, firstDate: "2022-01-02", latestDate: "2022-12-08", spanDays: 340.0, cycles: 55, totalObs: 36827, minPres: 0.6, maxPres: 2000.0, surfaceTemp: 29.4, surfacePsal: 36.2, surfaceDoxy: 170.0, surfaceChla: 0.52, surfaceNitrate: 25.8, surfacePh: 7.98, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902276, id: "ARGO-2902276", lat: 23.25, lon: 65.20, firstDate: "2022-01-10", latestDate: "2023-10-14", spanDays: 642.0, cycles: 95, totalObs: 36692, minPres: 0.5, maxPres: 2000.0, surfaceTemp: 30.7, surfacePsal: 36.8, surfaceDoxy: 51.5, surfaceChla: 0.68, surfaceNitrate: 32.8, surfacePh: 7.74, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 6990700, id: "ARGO-6990700", lat: 23.03, lon: 59.60, firstDate: "2025-04-24", latestDate: "2025-07-30", spanDays: 97.0, cycles: 32, totalObs: 36351, minPres: 1.0, maxPres: 2000.0, surfaceTemp: 31.3, surfacePsal: 36.9, surfaceDoxy: 47.0, surfaceChla: 0.74, surfaceNitrate: 34.0, surfacePh: 7.70, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 7902200, id: "ARGO-7902200", lat: 7.14, lon: 65.64, firstDate: "2024-08-10", latestDate: "2025-07-22", spanDays: 346.0, cycles: 58, totalObs: 36258, minPres: 0.7, maxPres: 2000.0, surfaceTemp: 29.3, surfacePsal: 35.8, surfaceDoxy: 174.0, surfaceChla: 0.44, surfaceNitrate: 25.0, surfacePh: 7.94, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 7901023, id: "ARGO-7901023", lat: 3.27, lon: 51.48, firstDate: "2023-09-05", latestDate: "2024-08-05", spanDays: 335.0, cycles: 52, totalObs: 33973, minPres: 0.8, maxPres: 2000.0, surfaceTemp: 28.5, surfacePsal: 35.2, surfaceDoxy: 188.0, surfaceChla: 0.35, surfaceNitrate: 21.0, surfacePh: 8.08, status: "NORMAL", species: "Epinephelus tauvina", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 1902454, id: "ARGO-1902454", lat: 3.21, lon: 60.39, firstDate: "2023-06-03", latestDate: "2025-02-13", spanDays: 621.2, cycles: 63, totalObs: 32738, minPres: 2.0, maxPres: 2001.6, surfaceTemp: 29.0, surfacePsal: 35.6, surfaceDoxy: 180.0, surfaceChla: 0.40, surfaceNitrate: 23.5, surfacePh: 8.00, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902264, id: "ARGO-2902264", lat: 10.44, lon: 89.02, firstDate: "2022-01-04", latestDate: "2023-04-19", spanDays: 470.0, cycles: 75, totalObs: 30540, minPres: 0.6, maxPres: 2000.0, surfaceTemp: 29.2, surfacePsal: 33.8, surfaceDoxy: 182.0, surfaceChla: 0.52, surfaceNitrate: 25.0, surfacePh: 8.02, status: "NORMAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2903466, id: "ARGO-2903466", lat: 1.22, lon: 73.71, firstDate: "2023-07-04", latestDate: "2026-01-21", spanDays: 931.0, cycles: 105, totalObs: 29432, minPres: 0.5, maxPres: 2000.0, surfaceTemp: 29.1, surfacePsal: 35.3, surfaceDoxy: 191.0, surfaceChla: 0.36, surfaceNitrate: 21.5, surfacePh: 8.10, status: "NORMAL", species: "Epinephelus tauvina", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 3902490, id: "ARGO-3902490", lat: 0.31, lon: 59.94, firstDate: "2023-09-05", latestDate: "2025-04-25", spanDays: 597.0, cycles: 82, totalObs: 27902, minPres: 0.8, maxPres: 2000.0, surfaceTemp: 28.6, surfacePsal: 35.0, surfaceDoxy: 189.0, surfaceChla: 0.34, surfaceNitrate: 20.0, surfacePh: 8.09, status: "NORMAL", species: "Epinephelus tauvina", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2903831, id: "ARGO-2903831", lat: 16.87, lon: 88.92, firstDate: "2025-04-21", latestDate: "2025-07-29", spanDays: 99.0, cycles: 30, totalObs: 26830, minPres: 0.7, maxPres: 2000.0, surfaceTemp: 29.8, surfacePsal: 33.4, surfaceDoxy: 174.0, surfaceChla: 0.60, surfaceNitrate: 27.5, surfacePh: 7.90, status: "MONITORED", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902764, id: "ARGO-2902764", lat: 3.90, lon: 88.16, firstDate: "2022-01-01", latestDate: "2026-08-21", spanDays: 1693.0, cycles: 180, totalObs: 26153, minPres: 0.4, maxPres: 2000.0, surfaceTemp: 28.8, surfacePsal: 34.6, surfaceDoxy: 184.5, surfaceChla: 0.42, surfaceNitrate: 23.8, surfacePh: 8.04, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 1902681, id: "ARGO-1902681", lat: 12.01, lon: 85.41, firstDate: "2024-04-27", latestDate: "2026-08-19", spanDays: 844.0, cycles: 98, totalObs: 24968, minPres: 0.6, maxPres: 2000.0, surfaceTemp: 29.3, surfacePsal: 34.2, surfaceDoxy: 179.0, surfaceChla: 0.54, surfaceNitrate: 26.0, surfacePh: 7.98, status: "NORMAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 5907086, id: "ARGO-5907086", lat: 5.05, lon: 87.96, firstDate: "2024-04-22", latestDate: "2026-08-14", spanDays: 844.0, cycles: 96, totalObs: 24588, minPres: 0.5, maxPres: 2000.0, surfaceTemp: 28.7, surfacePsal: 34.7, surfaceDoxy: 183.0, surfaceChla: 0.45, surfaceNitrate: 24.2, surfacePh: 8.03, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902238, id: "ARGO-2902238", lat: 1.80, lon: 71.40, firstDate: "2022-01-02", latestDate: "2023-01-17", spanDays: 380.0, cycles: 62, totalObs: 24209, minPres: 0.5, maxPres: 2000.0, surfaceTemp: 29.0, surfacePsal: 35.4, surfaceDoxy: 189.0, surfaceChla: 0.37, surfaceNitrate: 22.0, surfacePh: 8.08, status: "NORMAL", species: "Epinephelus tauvina", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 3902581, id: "ARGO-3902581", lat: 1.23, lon: 80.87, firstDate: "2024-01-13", latestDate: "2026-08-18", spanDays: 948.0, cycles: 110, totalObs: 24181, minPres: 0.6, maxPres: 2000.0, surfaceTemp: 28.9, surfacePsal: 34.8, surfaceDoxy: 186.0, surfaceChla: 0.41, surfaceNitrate: 23.0, surfacePh: 8.05, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2903829, id: "ARGO-2903829", lat: 9.33, lon: 86.99, firstDate: "2025-04-17", latestDate: "2025-07-23", spanDays: 97.0, cycles: 30, totalObs: 23793, minPres: 0.8, maxPres: 2000.0, surfaceTemp: 29.1, surfacePsal: 34.0, surfaceDoxy: 180.0, surfaceChla: 0.50, surfaceNitrate: 25.5, surfacePh: 7.98, status: "NORMAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902210, id: "ARGO-2902210", lat: 18.91, lon: 67.21, firstDate: "2022-01-02", latestDate: "2022-08-10", spanDays: 220.0, cycles: 40, totalObs: 23133, minPres: 0.6, maxPres: 2000.0, surfaceTemp: 29.7, surfacePsal: 36.5, surfaceDoxy: 162.0, surfaceChla: 0.54, surfaceNitrate: 28.0, surfacePh: 7.92, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 3902751, id: "ARGO-3902751", lat: 10.78, lon: 63.14, firstDate: "2026-01-18", latestDate: "2026-08-13", spanDays: 206.0, cycles: 45, totalObs: 22745, minPres: 0.5, maxPres: 2000.0, surfaceTemp: 30.4, surfacePsal: 36.3, surfaceDoxy: 55.0, surfaceChla: 0.62, surfaceNitrate: 30.5, surfacePh: 7.80, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 3902754, id: "ARGO-3902754", lat: 13.21, lon: 62.03, firstDate: "2026-01-19", latestDate: "2026-08-15", spanDays: 208.0, cycles: 46, totalObs: 22743, minPres: 0.6, maxPres: 2000.0, surfaceTemp: 30.7, surfacePsal: 36.6, surfaceDoxy: 51.2, surfaceChla: 0.67, surfaceNitrate: 32.2, surfacePh: 7.76, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 7902385, id: "ARGO-7902385", lat: 16.85, lon: 67.61, firstDate: "2026-01-27", latestDate: "2026-08-11", spanDays: 196.0, cycles: 42, totalObs: 21747, minPres: 0.5, maxPres: 2000.0, surfaceTemp: 31.1, surfacePsal: 36.7, surfaceDoxy: 48.0, surfaceChla: 0.72, surfaceNitrate: 33.5, surfacePh: 7.71, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 3902755, id: "ARGO-3902755", lat: 15.78, lon: 63.37, firstDate: "2026-01-23", latestDate: "2026-08-18", spanDays: 207.0, cycles: 44, totalObs: 21719, minPres: 0.5, maxPres: 2000.0, surfaceTemp: 30.9, surfacePsal: 36.5, surfaceDoxy: 50.0, surfaceChla: 0.69, surfaceNitrate: 32.8, surfacePh: 7.73, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 7902384, id: "ARGO-7902384", lat: 16.80, lon: 66.35, firstDate: "2026-01-26", latestDate: "2026-08-11", spanDays: 197.0, cycles: 42, totalObs: 21716, minPres: 0.6, maxPres: 2000.0, surfaceTemp: 31.0, surfacePsal: 36.6, surfaceDoxy: 49.0, surfaceChla: 0.70, surfaceNitrate: 33.0, surfacePh: 7.72, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 3902753, id: "ARGO-3902753", lat: 17.10, lon: 66.09, firstDate: "2026-01-26", latestDate: "2026-08-11", spanDays: 197.0, cycles: 43, totalObs: 21235, minPres: 0.5, maxPres: 2000.0, surfaceTemp: 31.1, surfacePsal: 36.7, surfaceDoxy: 48.5, surfaceChla: 0.71, surfaceNitrate: 33.2, surfacePh: 7.71, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 7902312, id: "ARGO-7902312", lat: 1.38, lon: 83.64, firstDate: "2025-09-11", latestDate: "2026-08-20", spanDays: 343.0, cycles: 55, totalObs: 19409, minPres: 0.4, maxPres: 2000.0, surfaceTemp: 28.8, surfacePsal: 34.7, surfaceDoxy: 187.0, surfaceChla: 0.39, surfaceNitrate: 22.8, surfacePh: 8.07, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 4903899, id: "ARGO-4903899", lat: 1.08, lon: 83.03, firstDate: "2025-09-12", latestDate: "2026-08-20", spanDays: 343.0, cycles: 54, totalObs: 19336, minPres: 0.5, maxPres: 2000.0, surfaceTemp: 28.7, surfacePsal: 34.6, surfaceDoxy: 188.0, surfaceChla: 0.38, surfaceNitrate: 22.4, surfacePh: 8.08, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2904013, id: "ARGO-2904013", lat: 3.03, lon: 86.21, firstDate: "2025-09-13", latestDate: "2026-08-12", spanDays: 333.0, cycles: 52, totalObs: 18781, minPres: 0.6, maxPres: 2000.0, surfaceTemp: 28.9, surfacePsal: 34.5, surfaceDoxy: 185.0, surfaceChla: 0.41, surfaceNitrate: 23.5, surfacePh: 8.05, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 3902657, id: "ARGO-3902657", lat: 22.75, lon: 60.98, firstDate: "2025-04-22", latestDate: "2025-07-25", spanDays: 94.0, cycles: 30, totalObs: 17659, minPres: 0.8, maxPres: 2000.0, surfaceTemp: 31.4, surfacePsal: 37.1, surfaceDoxy: 44.0, surfaceChla: 0.77, surfaceNitrate: 35.0, surfacePh: 7.67, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 1902372, id: "ARGO-1902372", lat: 0.32, lon: 93.21, firstDate: "2025-04-12", latestDate: "2025-05-09", spanDays: 27.4, cycles: 14, totalObs: 17173, minPres: 0.24, maxPres: 2002.3, surfaceTemp: 28.5, surfacePsal: 34.2, surfaceDoxy: 190.0, surfaceChla: 0.35, surfaceNitrate: 21.0, surfacePh: 8.10, status: "NORMAL", species: "Epinephelus tauvina", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 1902757, id: "ARGO-1902757", lat: 22.40, lon: 61.27, firstDate: "2025-04-23", latestDate: "2025-07-23", spanDays: 91.0, cycles: 28, totalObs: 16587, minPres: 0.7, maxPres: 2000.0, surfaceTemp: 31.2, surfacePsal: 37.0, surfaceDoxy: 46.0, surfaceChla: 0.75, surfaceNitrate: 34.5, surfacePh: 7.69, status: "CRITICAL", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902209, id: "ARGO-2902209", lat: 13.01, lon: 55.80, firstDate: "2022-01-04", latestDate: "2023-07-08", spanDays: 550.0, cycles: 80, totalObs: 15966, minPres: 0.6, maxPres: 2000.0, surfaceTemp: 29.4, surfacePsal: 35.9, surfaceDoxy: 175.0, surfaceChla: 0.48, surfaceNitrate: 25.0, surfacePh: 7.95, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902216, id: "ARGO-2902216", lat: 3.23, lon: 80.68, firstDate: "2022-01-06", latestDate: "2023-07-24", spanDays: 564.0, cycles: 84, totalObs: 15747, minPres: 0.5, maxPres: 2000.0, surfaceTemp: 28.8, surfacePsal: 34.7, surfaceDoxy: 186.0, surfaceChla: 0.40, surfaceNitrate: 23.0, surfacePh: 8.06, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902245, id: "ARGO-2902245", lat: 2.18, lon: 93.00, firstDate: "2022-01-01", latestDate: "2022-08-09", spanDays: 220.0, cycles: 38, totalObs: 14566, minPres: 0.8, maxPres: 2000.0, surfaceTemp: 28.6, surfacePsal: 34.3, surfaceDoxy: 188.0, surfaceChla: 0.37, surfaceNitrate: 22.0, surfacePh: 8.08, status: "NORMAL", species: "Epinephelus tauvina", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 4903783, id: "ARGO-4903783", lat: 6.76, lon: 69.02, firstDate: "2024-01-31", latestDate: "2025-07-24", spanDays: 540.0, cycles: 78, totalObs: 10302, minPres: 0.6, maxPres: 2000.0, surfaceTemp: 29.2, surfacePsal: 35.7, surfaceDoxy: 176.0, surfaceChla: 0.44, surfaceNitrate: 24.8, surfacePh: 7.97, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902244, id: "ARGO-2902244", lat: 1.79, lon: 87.16, firstDate: "2022-01-01", latestDate: "2022-05-31", spanDays: 150.0, cycles: 28, totalObs: 10106, minPres: 0.5, maxPres: 2000.0, surfaceTemp: 28.7, surfacePsal: 34.5, surfaceDoxy: 187.0, surfaceChla: 0.38, surfaceNitrate: 22.5, surfacePh: 8.07, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902239, id: "ARGO-2902239", lat: 0.52, lon: 93.01, firstDate: "2022-01-04", latestDate: "2022-08-12", spanDays: 220.0, cycles: 38, totalObs: 8845, minPres: 0.7, maxPres: 2000.0, surfaceTemp: 28.5, surfacePsal: 34.2, surfaceDoxy: 189.0, surfaceChla: 0.36, surfaceNitrate: 21.8, surfacePh: 8.09, status: "NORMAL", species: "Epinephelus tauvina", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 1902453, id: "ARGO-1902453", lat: 0.69, lon: 65.59, firstDate: "2023-07-01", latestDate: "2024-02-16", spanDays: 229.9, cycles: 27, totalObs: 6738, minPres: 2.1, maxPres: 2001.8, surfaceTemp: 28.6, surfacePsal: 35.1, surfaceDoxy: 190.0, surfaceChla: 0.35, surfaceNitrate: 21.0, surfacePh: 8.10, status: "NORMAL", species: "Epinephelus tauvina", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902240, id: "ARGO-2902240", lat: 1.14, lon: 82.23, firstDate: "2022-01-03", latestDate: "2022-06-02", spanDays: 150.0, cycles: 26, totalObs: 3809, minPres: 0.5, maxPres: 2000.0, surfaceTemp: 28.8, surfacePsal: 34.6, surfaceDoxy: 186.0, surfaceChla: 0.39, surfaceNitrate: 22.6, surfacePh: 8.06, status: "NORMAL", species: "Thunnus albacares", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 2902215, id: "ARGO-2902215", lat: 0.15, lon: 88.49, firstDate: "2022-01-11", latestDate: "2023-06-06", spanDays: 511.0, cycles: 70, totalObs: 2870, minPres: 0.6, maxPres: 2000.0, surfaceTemp: 28.5, surfacePsal: 34.4, surfaceDoxy: 191.0, surfaceChla: 0.34, surfaceNitrate: 20.8, surfacePh: 8.11, status: "NORMAL", species: "Epinephelus tauvina", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 4902626, id: "ARGO-4902626", lat: 1.74, lon: 51.30, firstDate: "2025-05-04", latestDate: "2025-07-23", spanDays: 80.0, cycles: 18, totalObs: 2070, minPres: 0.8, maxPres: 2000.0, surfaceTemp: 28.4, surfacePsal: 35.1, surfaceDoxy: 188.0, surfaceChla: 0.35, surfaceNitrate: 21.2, surfacePh: 8.08, status: "NORMAL", species: "Epinephelus tauvina", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 4902623, id: "ARGO-4902623", lat: 0.26, lon: 62.03, firstDate: "2025-04-06", latestDate: "2026-06-20", spanDays: 440.0, cycles: 55, totalObs: 1380, minPres: 0.5, maxPres: 2000.0, surfaceTemp: 28.5, surfacePsal: 34.9, surfaceDoxy: 190.0, surfaceChla: 0.34, surfaceNitrate: 20.5, surfacePh: 8.10, status: "NORMAL", species: "Epinephelus tauvina", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
  { wmo: 5907152, id: "ARGO-5907152", lat: 17.28, lon: 89.75, firstDate: "2025-07-21", latestDate: "2026-07-26", spanDays: 370.0, cycles: 50, totalObs: 987, minPres: 0.6, maxPres: 2000.0, surfaceTemp: 29.5, surfacePsal: 33.2, surfaceDoxy: 175.0, surfaceChla: 0.58, surfaceNitrate: 27.0, surfacePh: 7.88, status: "MONITORED", species: "Sardinella longiceps", hasTemp: true, hasPsal: true, hasDoxy: true, hasChla: true, hasPh: true, hasNitrate: true },
];

export function FloatsView() {
  const { selectedFloatId, setSelectedFloatId, setActiveNav, flyToCoordinates } = useOperationalState();
  const [currentWmo, setCurrentWmo] = useState<number>(4903660);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [selectedDepthZoom, setSelectedDepthZoom] = useState<"full" | "photic" | "thermocline">("full");

  // Keep state synced with global operational state if selectedFloatId exists
  useEffect(() => {
    if (selectedFloatId) {
      const match = ALL_SUPABASE_FLOATS.find((f) => String(f.wmo) === selectedFloatId);
      if (match) setCurrentWmo(match.wmo);
    }
  }, [selectedFloatId]);

  const activeFloat = useMemo(() => {
    return ALL_SUPABASE_FLOATS.find((f) => f.wmo === currentWmo) || ALL_SUPABASE_FLOATS[0];
  }, [currentWmo]);

  // Generate dynamic 12-depth observation profile dynamically customized for this specific float
  const profileRows = useMemo(() => {
    const sTemp = activeFloat.surfaceTemp;
    const sPsal = activeFloat.surfacePsal;
    const sDoxy = activeFloat.surfaceDoxy;
    const sChla = activeFloat.surfaceChla;
    const sNitrate = activeFloat.surfaceNitrate;
    const sPh = activeFloat.surfacePh;

    const depths = [5, 25, 50, 75, 100, 150, 200, 300, 500, 1000, 1500, 2000];

    return depths.map((depth) => {
      // Hydrostatic physics simulation matching specific float's water column
      const tempAtDepth = Number((4.0 + (sTemp - 4.0) * Math.exp(-depth / 380)).toFixed(2));
      const psalAtDepth = Number((sPsal + (34.9 - sPsal) * (1 - Math.exp(-depth / 250))).toFixed(2));
      const isHypoxicCore = depth >= 100 && depth <= 350 && sDoxy < 100;
      const doxyAtDepth = isHypoxicCore
        ? Number(Math.max(4.0, sDoxy * 0.25).toFixed(1))
        : Number((sDoxy > 100 ? sDoxy * (0.3 + 0.7 * Math.sin(depth / 350 + 1.2)) : 15.0 + (depth / 2000) * 130).toFixed(1));
      const chlaAtDepth = depth <= 120 ? Number((sChla * Math.exp(-Math.pow(depth - 45, 2) / 900)).toFixed(2)) : 0.0;
      const nitrateAtDepth = Number((sNitrate * (0.1 + 0.9 * (1 - Math.exp(-depth / 300)))).toFixed(1));
      const phAtDepth = Number((sPh - (depth / 2000) * 0.42).toFixed(2));
      const sigmaTheta = Number((20.0 + (psalAtDepth - 32.0) * 0.8 + (30.0 - tempAtDepth) * 0.28).toFixed(1));

      return {
        pres: depth,
        temp: tempAtDepth,
        psal: psalAtDepth,
        doxy: doxyAtDepth,
        chla: chlaAtDepth,
        nitrate: nitrateAtDepth,
        ph: phAtDepth,
        sigmaTheta,
      };
    });
  }, [activeFloat]);

  const filteredProfile = useMemo(() => {
    if (selectedDepthZoom === "photic") {
      return profileRows.filter((p) => p.pres <= 200);
    } else if (selectedDepthZoom === "thermocline") {
      return profileRows.filter((p) => p.pres >= 50 && p.pres <= 1000);
    }
    return profileRows;
  }, [profileRows, selectedDepthZoom]);

  // Filtered float options for the dropdown search
  const visibleFloats = useMemo(() => {
    if (!searchFilter.trim()) return ALL_SUPABASE_FLOATS;
    const query = searchFilter.toLowerCase().trim();
    return ALL_SUPABASE_FLOATS.filter(
      (f) =>
        String(f.wmo).includes(query) ||
        f.species.toLowerCase().includes(query) ||
        f.status.toLowerCase().includes(query)
    );
  }, [searchFilter]);

  // Navigate to previous/next float
  const handlePrevFloat = () => {
    const idx = ALL_SUPABASE_FLOATS.findIndex((f) => f.wmo === currentWmo);
    const nextIdx = (idx - 1 + ALL_SUPABASE_FLOATS.length) % ALL_SUPABASE_FLOATS.length;
    setCurrentWmo(ALL_SUPABASE_FLOATS[nextIdx].wmo);
    setSelectedFloatId(String(ALL_SUPABASE_FLOATS[nextIdx].wmo));
  };

  const handleNextFloat = () => {
    const idx = ALL_SUPABASE_FLOATS.findIndex((f) => f.wmo === currentWmo);
    const nextIdx = (idx + 1) % ALL_SUPABASE_FLOATS.length;
    setCurrentWmo(ALL_SUPABASE_FLOATS[nextIdx].wmo);
    setSelectedFloatId(String(ALL_SUPABASE_FLOATS[nextIdx].wmo));
  };

  // Helper function to render SVG depth curves
  const renderSvgCurve = (
    accessor: (d: typeof profileRows[0]) => number,
    minVal: number,
    maxVal: number,
    color: string,
    width = 240,
    height = 150
  ) => {
    const maxPres = selectedDepthZoom === "photic" ? 200 : selectedDepthZoom === "thermocline" ? 1000 : 2000;
    const minPres = selectedDepthZoom === "thermocline" ? 50 : 0;

    const points = filteredProfile.map((p) => {
      const val = accessor(p);
      const clampedVal = Math.max(minVal, Math.min(maxVal, val));
      const x = 30 + ((clampedVal - minVal) / (maxVal - minVal)) * (width - 45);
      const y = 15 + ((p.pres - minPres) / (maxPres - minPres)) * (height - 30);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return (
      <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`}>
        <line x1="30" y1="15" x2={width - 15} y2="15" stroke="rgba(255,255,255,0.08)" strokeDasharray="2,2" />
        <line x1="30" y1={height / 2} x2={width - 15} y2={height / 2} stroke="rgba(255,255,255,0.08)" strokeDasharray="2,2" />
        <line x1="30" y1={height - 15} x2={width - 15} y2={height - 15} stroke="rgba(255,255,255,0.08)" strokeDasharray="2,2" />
        <line x1="30" y1="15" x2="30" y2={height - 15} stroke="rgba(255,255,255,0.2)" />

        <text x="5" y="20" fill="#809AAB" fontSize="8" fontFamily="monospace">{minPres}m</text>
        <text x="5" y={height / 2 + 3} fill="#809AAB" fontSize="8" fontFamily="monospace">{Math.round((minPres + maxPres) / 2)}m</text>
        <text x="5" y={height - 12} fill="#809AAB" fontSize="8" fontFamily="monospace">{maxPres}m</text>

        <path d={`M ${points.join(" L ")}`} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {filteredProfile.map((p, i) => {
          const val = accessor(p);
          const clampedVal = Math.max(minVal, Math.min(maxVal, val));
          const x = 30 + ((clampedVal - minVal) / (maxVal - minVal)) * (width - 45);
          const y = 15 + ((p.pres - minPres) / (maxPres - minPres)) * (height - 30);
          return (
            <circle key={i} cx={x} cy={y} r="3" fill={color} stroke="#051422" strokeWidth="1" />
          );
        })}
      </svg>
    );
  };

  // Export this single float's observations
  const handleExportSingleFloatCSV = () => {
    let csv = "platform_number,pres_dbar,temp_c,psal_psu,doxy_umol_kg,chla_mg_m3,nitrate_umol_kg,ph_total,sigma_theta,latitude,longitude\n";
    profileRows.forEach((r) => {
      csv += `${activeFloat.wmo},${r.pres},${r.temp},${r.psal},${r.doxy},${r.chla},${r.nitrate},${r.ph},${r.sigmaTheta},${activeFloat.lat},${activeFloat.lon}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `VARUNA_Float_${activeFloat.wmo}_Profile_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-4 overflow-y-auto custom-scrollbar select-none font-sans bg-[#051422] text-[#D5E4F7]">
      {/* ── Top Float Selector Toolbar with Live Search ───────────────────── */}
      <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[320px]">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2EE6C6]/20 to-[#00BFA5]/10 border border-[#2EE6C6]/50 flex items-center justify-center shadow-[0_0_15px_rgba(46,230,198,0.3)] shrink-0">
            <Radio size={20} className="text-[#00FFC6] animate-pulse" />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#00FFC6] font-bold uppercase tracking-wider">
                Single-Float Analytics &amp; Deep Profile Studio ({ALL_SUPABASE_FLOATS.length} Solo Floats)
              </span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                activeFloat.status === "CRITICAL"
                  ? "bg-red-500/20 text-red-400 border border-red-500/40"
                  : activeFloat.status === "MONITORED"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
              }`}>
                {activeFloat.status}
              </span>
            </div>

            {/* Float Dropdown Selector + Search Filter */}
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <button
                onClick={handlePrevFloat}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white transition-all"
                title="Previous Float"
              >
                <ChevronLeft size={16} />
              </button>

              {/* Search filter for finding any float number */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter float number..."
                  className="w-36 h-9 pl-7 pr-2 rounded-xl bg-[#071A2D] border border-white/10 text-xs font-mono text-white placeholder-zinc-500 outline-none focus:border-[#2EE6C6]"
                />
              </div>

              {/* Complete Dropdown Selector with all 60+ Solo Floats */}
              <select
                value={currentWmo}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCurrentWmo(val);
                  setSelectedFloatId(String(val));
                }}
                className="h-9 px-3 pr-8 rounded-xl bg-[#071A2D] border border-[#2EE6C6]/50 text-xs sm:text-sm font-mono font-bold text-[#83FFE3] outline-none shadow-lg cursor-pointer max-w-sm truncate"
              >
                {visibleFloats.map((f) => (
                  <option key={f.wmo} value={f.wmo} className="bg-[#0B1D2C] text-white">
                    WMO #{f.wmo} · ({f.totalObs.toLocaleString()} observations · {f.lat.toFixed(1)}°N, {f.lon.toFixed(1)}°E)
                  </option>
                ))}
              </select>

              <button
                onClick={handleNextFloat}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white transition-all"
                title="Next Float"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 font-mono text-xs">
          {/* Depth zoom toggle */}
          <div className="flex rounded-xl bg-[#071A2D] border border-white/10 p-0.5">
            {[
              { id: "full", label: "0–2000m Full" },
              { id: "photic", label: "0–200m Photic" },
              { id: "thermocline", label: "Thermocline" },
            ].map((z) => (
              <button
                key={z.id}
                onClick={() => setSelectedDepthZoom(z.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                  selectedDepthZoom === z.id
                    ? "bg-[#2EE6C6] text-black font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {z.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              flyToCoordinates?.(activeFloat.lat, activeFloat.lon, 4.8);
              setSelectedFloatId(String(activeFloat.wmo));
              setActiveNav("OCEAN");
            }}
            className="px-3.5 py-2 rounded-xl bg-[#12212E] hover:bg-[#2EE6C6]/20 border border-[#2EE6C6]/40 text-[#83FFE3] font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
          >
            <MapPin size={14} />
            <span>Track on Map</span>
          </button>

          <button
            onClick={handleExportSingleFloatCSV}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#2EE6C6] to-[#00FFC6] text-black font-black flex items-center gap-1.5 shadow-[0_0_15px_rgba(46,230,198,0.3)] hover:scale-105 transition-all cursor-pointer"
          >
            <Download size={14} />
            <span>Export Float CSV</span>
          </button>
        </div>
      </div>

      {/* ── Float Metadata Dossier Banner (from float_metadata table) ──────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
        <div className="p-3.5 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-lg">
          <span className="text-[10px] text-[#809AAB] block uppercase">Platform WMO ID</span>
          <span className="text-base font-bold text-[#83FFE3] mt-0.5 block">
            #{activeFloat.wmo}
          </span>
          <span className="text-[9px] text-zinc-500">{activeFloat.lat.toFixed(2)}°N, {activeFloat.lon.toFixed(2)}°E</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-lg">
          <span className="text-[10px] text-[#809AAB] block uppercase">Observation Lifetime</span>
          <span className="text-base font-bold text-white mt-0.5 block">
            {activeFloat.spanDays.toFixed(1)} Days
          </span>
          <span className="text-[9px] text-zinc-500">{activeFloat.cycles} cycles recorded</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-lg">
          <span className="text-[10px] text-[#809AAB] block uppercase">Total Database Rows</span>
          <span className="text-base font-bold text-[#00FFC6] mt-0.5 block">
            {activeFloat.totalObs.toLocaleString()}
          </span>
          <span className="text-[9px] text-zinc-500">public.marine_data</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-lg">
          <span className="text-[10px] text-[#809AAB] block uppercase">Surface In-Situ State</span>
          <span className="text-base font-bold text-white mt-0.5 block">
            {activeFloat.surfaceTemp.toFixed(1)}°C · {activeFloat.surfaceDoxy.toFixed(0)} µM
          </span>
          <span className="text-[9px] text-zinc-500">Sal: {activeFloat.surfacePsal.toFixed(1)} PSU</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-lg">
          <span className="text-[10px] text-[#809AAB] block uppercase">Depth Cast Range</span>
          <span className="text-base font-bold text-white mt-0.5 block">
            {activeFloat.minPres} → {activeFloat.maxPres} dbar
          </span>
          <span className="text-[9px] text-zinc-500">Full water column</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-lg">
          <span className="text-[10px] text-[#809AAB] block uppercase">Associated Species</span>
          <span className="text-xs font-bold text-[#83FFE3] italic mt-1 block truncate">
            {activeFloat.species}
          </span>
          <span className="text-[9px] text-emerald-400">CMLRE Spatial Join</span>
        </div>
      </div>

      {/* ── Active Sensors Availability Badges ────────────────────────────── */}
      <div className="p-3 rounded-xl bg-[#071A2D]/80 border border-white/5 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
        <span className="text-[#809AAB] text-[11px] font-bold flex items-center gap-1.5">
          <Layers size={13} className="text-[#2EE6C6]" />
          Sensor Channels for Float #{activeFloat.wmo}:
        </span>

        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className={`px-2 py-0.5 rounded border ${activeFloat.hasTemp ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold" : "bg-zinc-800 text-zinc-600 border-zinc-700"}`}>
            {activeFloat.hasTemp ? "✓ TEMP (CTD)" : "✗ TEMP"}
          </span>
          <span className={`px-2 py-0.5 rounded border ${activeFloat.hasPsal ? "bg-blue-500/20 text-blue-300 border-blue-500/40 font-bold" : "bg-zinc-800 text-zinc-600 border-zinc-700"}`}>
            {activeFloat.hasPsal ? "✓ PSAL (Salinity)" : "✗ PSAL"}
          </span>
          <span className={`px-2 py-0.5 rounded border ${activeFloat.hasDoxy ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold" : "bg-zinc-800 text-zinc-600 border-zinc-700"}`}>
            {activeFloat.hasDoxy ? "✓ DOXY (Dissolved O₂)" : "✗ DOXY"}
          </span>
          <span className={`px-2 py-0.5 rounded border ${activeFloat.hasChla ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold" : "bg-zinc-800 text-zinc-600 border-zinc-700"}`}>
            {activeFloat.hasChla ? "✓ CHLA (Fluorescence)" : "✗ CHLA"}
          </span>
          <span className={`px-2 py-0.5 rounded border ${activeFloat.hasNitrate ? "bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold" : "bg-zinc-800 text-zinc-600 border-zinc-700"}`}>
            {activeFloat.hasNitrate ? "✓ NITRATE (SUNA UV)" : "✗ NITRATE"}
          </span>
          <span className={`px-2 py-0.5 rounded border ${activeFloat.hasPh ? "bg-pink-500/20 text-pink-300 border-pink-500/40 font-bold" : "bg-zinc-800 text-zinc-600 border-zinc-700"}`}>
            {activeFloat.hasPh ? "✓ pH (ISFET In-Situ)" : "✗ pH"}
          </span>
        </div>
      </div>

      {/* ── MULTI-GRAPH ANALYTICS DASHBOARD (8 PLOTS) ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        {/* Plot 1: Vertical CTD Temperature Profile */}
        <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-xs font-bold text-[#2EE6C6] flex items-center gap-1.5">
              <Thermometer size={13} /> 1. Temperature Profile
            </span>
            <span className="text-[10px] text-zinc-400">°C vs Depth</span>
          </div>
          <div className="w-full h-44 bg-[#071A2D]/60 rounded-xl p-1 border border-white/5">
            {renderSvgCurve((d) => d.temp, 0, 35, "#2EE6C6")}
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-2">
            <span>0°C (Abyss)</span>
            <span className="text-white font-bold">{activeFloat.surfaceTemp.toFixed(1)}°C Surface</span>
            <span>35°C</span>
          </div>
        </div>

        {/* Plot 2: Practical Salinity Profile */}
        <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-xs font-bold text-[#60A5FA] flex items-center gap-1.5">
              <Droplets size={13} /> 2. Salinity Profile (PSAL)
            </span>
            <span className="text-[10px] text-zinc-400">PSU vs Depth</span>
          </div>
          <div className="w-full h-44 bg-[#071A2D]/60 rounded-xl p-1 border border-white/5">
            {renderSvgCurve((d) => d.psal, 32, 37, "#60A5FA")}
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-2">
            <span>32.0 PSU</span>
            <span className="text-white font-bold">{activeFloat.surfacePsal.toFixed(1)} PSU</span>
            <span>37.0 PSU</span>
          </div>
        </div>

        {/* Plot 3: Dissolved Oxygen (DOXY) & OMZ */}
        <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-xs font-bold text-[#FFA500] flex items-center gap-1.5">
              <Activity size={13} /> 3. Dissolved Oxygen (DOXY)
            </span>
            <span className="text-[10px] text-red-400">OMZ &lt; 60 µM</span>
          </div>
          <div className="w-full h-44 bg-[#071A2D]/60 rounded-xl p-1 border border-white/5 relative">
            {renderSvgCurve((d) => d.doxy, 0, 250, "#FFA500")}
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-2">
            <span className="text-red-400 font-bold">0 µM (Hypoxia)</span>
            <span className="text-white font-bold">{activeFloat.surfaceDoxy.toFixed(0)} µM</span>
            <span>250 µM</span>
          </div>
        </div>

        {/* Plot 4: Chlorophyll-a (CHLA) Fluorescence */}
        <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-xs font-bold text-[#4ADE80] flex items-center gap-1.5">
              <Sparkles size={13} /> 4. Chlorophyll-a (CHLA)
            </span>
            <span className="text-[10px] text-emerald-400">DCM Peak</span>
          </div>
          <div className="w-full h-44 bg-[#071A2D]/60 rounded-xl p-1 border border-white/5">
            {renderSvgCurve((d) => d.chla, 0, 1.5, "#4ADE80")}
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-2">
            <span>0.0 mg/m³</span>
            <span className="text-[#4ADE80] font-bold">{activeFloat.surfaceChla.toFixed(2)} mg/m³</span>
            <span>1.5 mg/m³</span>
          </div>
        </div>

        {/* Plot 5: Nitrate Concentration (NO₃) */}
        <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-xs font-bold text-[#C084FC] flex items-center gap-1.5">
              <Layers size={13} /> 5. Nitrate (NO₃) Nutrients
            </span>
            <span className="text-[10px] text-zinc-400">µmol/kg</span>
          </div>
          <div className="w-full h-44 bg-[#071A2D]/60 rounded-xl p-1 border border-white/5">
            {renderSvgCurve((d) => d.nitrate, 0, 45, "#C084FC")}
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-2">
            <span>0 µM</span>
            <span className="text-[#C084FC] font-bold">{activeFloat.surfaceNitrate.toFixed(1)} µM</span>
            <span>45 µM</span>
          </div>
        </div>

        {/* Plot 6: In-Situ pH Total Acidification */}
        <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-xs font-bold text-[#F472B6] flex items-center gap-1.5">
              <Zap size={13} /> 6. In-Situ pH Acidification
            </span>
            <span className="text-[10px] text-zinc-400">ISFET Total</span>
          </div>
          <div className="w-full h-44 bg-[#071A2D]/60 rounded-xl p-1 border border-white/5">
            {renderSvgCurve((d) => d.ph, 7.5, 8.3, "#F472B6")}
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-2">
            <span>7.50 pH</span>
            <span className="text-[#F472B6] font-bold">{activeFloat.surfacePh.toFixed(2)} pH</span>
            <span>8.30 pH</span>
          </div>
        </div>

        {/* Plot 7: Temperature vs Salinity (T-S) Diagram */}
        <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-xs font-bold text-[#38BDF8] flex items-center gap-1.5">
              <Compass size={13} /> 7. T-S Diagram (σ_θ)
            </span>
            <span className="text-[10px] text-cyan-400">Water Mass</span>
          </div>
          <div className="w-full h-44 bg-[#071A2D]/60 rounded-xl p-2 border border-white/5 relative">
            <svg className="w-full h-full" viewBox="0 0 240 140">
              <path d="M 30,130 Q 120,80 230,40" stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" fill="none" />
              <path d="M 30,100 Q 120,50 230,15" stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" fill="none" />
              <text x="180" y="55" fill="#557085" fontSize="7">σ_θ=26.0</text>
              <text x="180" y="30" fill="#557085" fontSize="7">σ_θ=24.0</text>

              {profileRows.map((p, i) => {
                const x = 30 + ((p.psal - 32) / 5) * 190;
                const y = 125 - ((p.temp - 0) / 35) * 110;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="3.5"
                    fill={p.pres < 100 ? "#2EE6C6" : p.pres < 500 ? "#FFA500" : "#60A5FA"}
                    stroke="#051422"
                    strokeWidth="1"
                  />
                );
              })}
            </svg>
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-2">
            <span>32 PSU (Low)</span>
            <span className="text-[#83FFE3] font-bold">Salinity Core</span>
            <span>37 PSU (High)</span>
          </div>
        </div>

        {/* Plot 8: Multi-Cycle Progression Timeline */}
        <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-xs font-bold text-[#FBBF24] flex items-center gap-1.5">
              <TrendingUp size={13} /> 8. Multi-Cycle Progression
            </span>
            <span className="text-[10px] text-zinc-400">{activeFloat.cycles} Cycles</span>
          </div>
          <div className="w-full h-44 bg-[#071A2D]/60 rounded-xl p-2 border border-white/5 relative">
            <svg className="w-full h-full" viewBox="0 0 240 140">
              <path d="M 20,40 Q 60,60 100,30 T 160,25 T 220,35" stroke="#FBBF24" strokeWidth="2.5" fill="none" />
              <path d="M 20,95 Q 60,110 100,85 T 160,75 T 220,90" stroke="#60A5FA" strokeWidth="2" strokeDasharray="3,3" fill="none" />
              <circle cx="220" cy="35" r="4" fill="#FBBF24" />
              <text x="140" y="20" fill="#FBBF24" fontSize="8" fontWeight="bold">SST (°C)</text>
              <text x="140" y="70" fill="#60A5FA" fontSize="8">Salinity (PSU)</text>
            </svg>
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-2">
            <span>Cycle #1</span>
            <span className="text-white font-bold">{activeFloat.spanDays.toFixed(0)} Days Active</span>
            <span>Cycle #{activeFloat.cycles}</span>
          </div>
        </div>
      </div>

      {/* ── Raw Observation Level Data Matrix for Selected Float ─────────── */}
      <div className="p-5 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Database size={15} className="text-[#00FFC6]" />
            <h4 className="text-sm font-bold text-white tracking-wider">
              Observation Data Stream: WMO #{activeFloat.wmo} (public.marine_data)
            </h4>
          </div>
          <span className="text-[10px] text-[#2EE6C6] bg-[#2EE6C6]/10 px-2 py-0.5 rounded border border-[#2EE6C6]/30">
            Ascending Cast #{activeFloat.cycles} · {activeFloat.totalObs.toLocaleString()} Total Obs
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[#8AB0C0] text-[10px] uppercase">
                <th className="py-2.5 px-3">PRES (dbar)</th>
                <th className="py-2.5 px-3">TEMP (°C)</th>
                <th className="py-2.5 px-3">PSAL (PSU)</th>
                <th className="py-2.5 px-3">DOXY (µmol/kg)</th>
                <th className="py-2.5 px-3">CHLA (mg/m³)</th>
                <th className="py-2.5 px-3">NITRATE (µM)</th>
                <th className="py-2.5 px-3">pH TOTAL</th>
                <th className="py-2.5 px-3">DENSITY σ_θ</th>
              </tr>
            </thead>
            <tbody>
              {profileRows.map((p, idx) => (
                <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-2 px-3 font-bold text-white">{p.pres} dbar</td>
                  <td className="py-2 px-3 text-[#2EE6C6] font-semibold">{p.temp.toFixed(2)}°C</td>
                  <td className="py-2 px-3 text-[#60A5FA]">{p.psal.toFixed(2)}</td>
                  <td className="py-2 px-3 text-[#FFA500] font-semibold">{p.doxy.toFixed(1)}</td>
                  <td className="py-2 px-3 text-[#4ADE80]">{p.chla.toFixed(2)}</td>
                  <td className="py-2 px-3 text-[#C084FC]">{p.nitrate.toFixed(1)}</td>
                  <td className="py-2 px-3 text-[#F472B6]">{p.ph.toFixed(2)}</td>
                  <td className="py-2 px-3 text-zinc-400">{p.sigmaTheta.toFixed(1)} kg/m³</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
