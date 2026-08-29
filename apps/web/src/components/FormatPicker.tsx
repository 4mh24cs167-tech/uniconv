"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export interface FormatPickerProps {
  formats: string[];
  selectedFormat: string;
  onSelect: (format: string) => void;
}

export function FormatPicker({ formats, selectedFormat, onSelect }: FormatPickerProps) {
  if (formats.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label htmlFor="format-picker">Convert to</Label>
      <Select 
        value={selectedFormat} 
        onValueChange={(value) => {
          if (value) onSelect(value);
        }}
      >
        <SelectTrigger id="format-picker" className="w-full sm:w-[200px]">
          <SelectValue placeholder="Select format" />
        </SelectTrigger>
        <SelectContent>
          {formats.map((format) => (
            <SelectItem key={format} value={format}>
              {format.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
