"use client";

import React from "react";
import { DatasetsExportPanel } from "./DatasetsExportPanel";

export function DatasetsView() {
  return (
    <div className="flex flex-col h-full space-y-3 p-1 overflow-y-auto custom-scrollbar select-none">
      <div className="min-h-[500px]">
        <DatasetsExportPanel />
      </div>
    </div>
  );
}
