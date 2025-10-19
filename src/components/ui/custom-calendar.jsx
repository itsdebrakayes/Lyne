import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const CustomCalendar = ({ selected, onSelect, className }) => {
  const [view, setView] = useState("day"); // "day", "month", "year"
  const [currentDate, setCurrentDate] = useState(selected || new Date());

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handlePrevious = () => {
    if (view === "day") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (view === "year") {
      setCurrentDate(new Date(currentDate.getFullYear() - 12, currentDate.getMonth(), 1));
    }
  };

  const handleNext = () => {
    if (view === "day") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (view === "year") {
      setCurrentDate(new Date(currentDate.getFullYear() + 12, currentDate.getMonth(), 1));
    }
  };

  const handleDateClick = (day) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    onSelect(newDate);
  };

  const handleMonthClick = (monthIndex) => {
    setCurrentDate(new Date(currentDate.getFullYear(), monthIndex, 1));
    setView("day");
  };

  const handleYearClick = (year) => {
    setCurrentDate(new Date(year, currentDate.getMonth(), 1));
    setView("month");
  };

  const renderDayView = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2" />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = selected &&
        selected.getDate() === day &&
        selected.getMonth() === currentDate.getMonth() &&
        selected.getFullYear() === currentDate.getFullYear();

      days.push(
        <button
          key={day}
          onClick={() => handleDateClick(day)}
          className={cn(
            "p-2 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-primary/20",
            isSelected && "bg-primary text-primary-foreground shadow-lg"
          )}
        >
          {day}
        </button>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
            <div key={i} className="p-2">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    return (
      <div className="grid grid-cols-3 gap-3">
        {months.map((month, index) => (
          <button
            key={month}
            onClick={() => handleMonthClick(index)}
            className={cn(
              "p-3 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-primary/20",
              currentDate.getMonth() === index && "bg-primary/10"
            )}
          >
            {month.substring(0, 3)}
          </button>
        ))}
      </div>
    );
  };

  const renderYearView = () => {
    const startYear = Math.floor(currentDate.getFullYear() / 12) * 12;
    const years = [];

    for (let i = 0; i < 12; i++) {
      years.push(startYear + i);
    }

    return (
      <div className="grid grid-cols-3 gap-3">
        {years.map((year) => (
          <button
            key={year}
            onClick={() => handleYearClick(year)}
            className={cn(
              "p-3 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-primary/20",
              currentDate.getFullYear() === year && "bg-primary/10"
            )}
          >
            {year}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className={cn("glass p-4 rounded-xl space-y-4 pointer-events-auto", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevious}
          className="h-8 w-8 hover:bg-primary/20"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <button
          onClick={() => {
            if (view === "day") setView("month");
            else if (view === "month") setView("year");
          }}
          className="text-base font-semibold hover:text-primary transition-colors cursor-pointer"
        >
          {view === "day" && `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
          {view === "month" && currentDate.getFullYear()}
          {view === "year" && `${Math.floor(currentDate.getFullYear() / 12) * 12} - ${Math.floor(currentDate.getFullYear() / 12) * 12 + 11}`}
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleNext}
          className="h-8 w-8 hover:bg-primary/20"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div>
        {view === "day" && renderDayView()}
        {view === "month" && renderMonthView()}
        {view === "year" && renderYearView()}
      </div>
    </div>
  );
};
