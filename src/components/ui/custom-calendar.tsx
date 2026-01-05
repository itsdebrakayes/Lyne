import * as React from "react";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  getDay,
  subYears,
} from "date-fns";

interface CustomCalendarProps {
  selected: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  className?: string;
  disabled?: (date: Date) => boolean;
}

export function CustomCalendar({ selected, onSelect, className, disabled }: CustomCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selected || new Date());
  
  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const startDay = getDay(startOfMonth(currentMonth));
  const emptyDays = Array(startDay).fill(null);

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  // Years dropdown - go back 100 years from current
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  const handleYearChange = (year: number) => {
    const newDate = new Date(currentMonth);
    newDate.setFullYear(year);
    setCurrentMonth(newDate);
  };

  return (
    <div className={cn("p-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-2">
          <span className="font-medium">{format(currentMonth, "MMMM")}</span>
          <select
            value={currentMonth.getFullYear()}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="bg-background border border-input rounded-md px-2 py-1 text-sm"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        
        <Button variant="outline" size="icon" onClick={goToNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {emptyDays.map((_, index) => (
          <div key={`empty-${index}`} className="h-8 w-8" />
        ))}
        {days.map((day) => {
          const isSelected = selected && isSameDay(day, selected);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());
          const isDisabled = disabled ? disabled(day) : false;

          return (
            <Button
              key={day.toISOString()}
              variant="ghost"
              size="sm"
              disabled={isDisabled}
              className={cn(
                "h-8 w-8 p-0 font-normal",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                !isSelected && isToday && "bg-accent text-accent-foreground",
                !isCurrentMonth && "text-muted-foreground opacity-50",
                isDisabled && "opacity-30 cursor-not-allowed"
              )}
              onClick={() => !isDisabled && onSelect(day)}
            >
              {format(day, "d")}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
