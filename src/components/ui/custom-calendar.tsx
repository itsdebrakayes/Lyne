import * as React from "react";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  getDay,
} from "date-fns";

type CalendarView = "decade" | "months" | "days";

interface CustomCalendarProps {
  selected: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  className?: string;
  disabled?: (date: Date) => boolean;
}

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December"
];

export function CustomCalendar({ selected, onSelect, className, disabled }: CustomCalendarProps) {
  const currentYear = new Date().getFullYear();
  
  // Calculate the starting decade (ending with current year)
  const getDecadeStart = (year: number) => Math.floor(year / 10) * 10;
  
  const [view, setView] = useState<CalendarView>("decade");
  const [selectedYear, setSelectedYear] = useState<number | undefined>(selected?.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(selected?.getMonth());
  const [decadeStart, setDecadeStart] = useState(getDecadeStart(currentYear));
  const [currentDisplayMonth, setCurrentDisplayMonth] = useState(selected || new Date());

  // Update internal state when selected prop changes
  useEffect(() => {
    if (selected) {
      setSelectedYear(selected.getFullYear());
      setSelectedMonth(selected.getMonth());
      setCurrentDisplayMonth(selected);
    }
  }, [selected]);

  // Generate years for current decade view (10 years)
  const decadeYears = Array.from({ length: 10 }, (_, i) => decadeStart + i);

  // Navigate decades
  const goToPreviousDecade = () => setDecadeStart(decadeStart - 10);
  const goToNextDecade = () => setDecadeStart(decadeStart + 10);

  // Handle year selection
  const handleYearClick = (year: number) => {
    setSelectedYear(year);
    setView("months");
  };

  // Handle month selection
  const handleMonthClick = (monthIndex: number) => {
    setSelectedMonth(monthIndex);
    if (selectedYear) {
      const newDate = new Date(selectedYear, monthIndex, 1);
      setCurrentDisplayMonth(newDate);
    }
    setView("days");
  };

  // Handle day selection
  const handleDayClick = (day: Date) => {
    onSelect(day);
    setSelectedYear(day.getFullYear());
    setSelectedMonth(day.getMonth());
  };

  // Navigation for days view
  const goToPreviousMonth = () => {
    const newMonth = new Date(currentDisplayMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCurrentDisplayMonth(newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = new Date(currentDisplayMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCurrentDisplayMonth(newMonth);
  };

  // Click handlers for header elements to navigate back
  const handleHeaderYearClick = () => {
    if (selectedYear) {
      setDecadeStart(getDecadeStart(selectedYear));
    }
    setView("decade");
  };

  const handleHeaderMonthClick = () => {
    setView("months");
  };

  // Days grid calculation
  const days = eachDayOfInterval({
    start: startOfMonth(currentDisplayMonth),
    end: endOfMonth(currentDisplayMonth),
  });
  const startDay = getDay(startOfMonth(currentDisplayMonth));
  const emptyDays = Array(startDay).fill(null);

  // Check if a decade has any selectable years (for DOB - no future years)
  const hasFutureYears = decadeStart > currentYear;

  return (
    <div className={cn("p-3 min-w-[280px]", className)}>
      {/* DECADE VIEW */}
      {view === "decade" && (
        <>
          {/* Header with navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={goToPreviousDecade}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <span className="font-semibold text-sm">
              {decadeStart} - {decadeStart + 9}
            </span>
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={goToNextDecade}
              disabled={decadeStart + 10 > currentYear}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Years grid */}
          <div className="grid grid-cols-4 gap-2">
            {decadeYears.map((year) => {
              const isSelected = selectedYear === year;
              const isFuture = year > currentYear;
              
              return (
                <Button
                  key={year}
                  variant="ghost"
                  size="sm"
                  disabled={isFuture}
                  className={cn(
                    "h-10 font-normal",
                    isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    isFuture && "opacity-30 cursor-not-allowed"
                  )}
                  onClick={() => !isFuture && handleYearClick(year)}
                >
                  {year}
                </Button>
              );
            })}
          </div>
        </>
      )}

      {/* MONTHS VIEW */}
      {view === "months" && (
        <>
          {/* Header with back button */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => setView("decade")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <button
              onClick={handleHeaderYearClick}
              className="font-semibold text-sm hover:text-primary transition-colors cursor-pointer"
            >
              {selectedYear}
            </button>
            
            <div className="w-8" /> {/* Spacer for alignment */}
          </div>

          {/* Months grid */}
          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((month, index) => {
              const isSelected = selectedMonth === index && selectedYear === selected?.getFullYear();
              const isFuture = selectedYear === currentYear && index > new Date().getMonth();
              
              return (
                <Button
                  key={month}
                  variant="ghost"
                  size="sm"
                  disabled={isFuture}
                  className={cn(
                    "h-10 font-normal text-xs",
                    isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    isFuture && "opacity-30 cursor-not-allowed"
                  )}
                  onClick={() => !isFuture && handleMonthClick(index)}
                >
                  {month.slice(0, 3)}
                </Button>
              );
            })}
          </div>
        </>
      )}

      {/* DAYS VIEW */}
      {view === "days" && (
        <>
          {/* Header with clickable month and year */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => setView("months")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-1">
              <button
                onClick={handleHeaderMonthClick}
                className="font-semibold text-sm hover:text-primary transition-colors cursor-pointer"
              >
                {format(currentDisplayMonth, "MMMM")}
              </button>
              <button
                onClick={handleHeaderYearClick}
                className="font-semibold text-sm hover:text-primary transition-colors cursor-pointer"
              >
                {format(currentDisplayMonth, "yyyy")}
              </button>
            </div>
            
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToNextMonth}>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
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
              const isCurrentMonth = isSameMonth(day, currentDisplayMonth);
              const isToday = isSameDay(day, new Date());
              const isFuture = day > new Date();
              const isDisabled = disabled ? disabled(day) : isFuture;

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
                  onClick={() => !isDisabled && handleDayClick(day)}
                >
                  {format(day, "d")}
                </Button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
