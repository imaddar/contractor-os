import React, { useState, useMemo } from "react";
import type { Schedule } from "../api/schedules";
import type { Project } from "../api/projects";
import { Icon } from "./Icon";

interface CalendarProps {
  schedules: Schedule[];
  projects: Project[];
  onDateClick: (date: Date) => void;
  onEventClick: (schedule: Schedule) => void;
}

interface CalendarEvent {
  schedule: Schedule;
  project: Project;
  startDate: Date;
  endDate: Date;
}

const Calendar: React.FC<CalendarProps> = ({
  schedules,
  projects,
  onDateClick,
  onEventClick,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Memoize calendar events to avoid recalculation on every render
  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    return schedules.reduce<CalendarEvent[]>((accumulator, schedule) => {
      if (!schedule.start_date) {
        return accumulator;
      }

      const parsedStart = new Date(schedule.start_date);
      if (Number.isNaN(parsedStart.getTime())) {
        return accumulator;
      }

      const parsedEnd = schedule.end_date ? new Date(schedule.end_date) : null;
      const resolvedEnd =
        parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : new Date(parsedStart);

      const startDate = new Date(
        parsedStart.getFullYear(),
        parsedStart.getMonth(),
        parsedStart.getDate(),
      );
      const endDate = new Date(
        resolvedEnd.getFullYear(),
        resolvedEnd.getMonth(),
        resolvedEnd.getDate(),
      );

      const project = projects.find((p) => p.id === schedule.project_id);

      accumulator.push({
        schedule,
        project: project || {
          id: 0,
          name: "Unknown Project",
          status: "active",
        },
        startDate,
        endDate,
      });

      return accumulator;
    }, []);
  }, [schedules, projects]);

  // Memoize events by date for the current month to avoid repeated filtering
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Helper function to check if an event intersects with the current month
    const isEventInMonth = (event: CalendarEvent, year: number, month: number): boolean => {
      const eventStartMonth = event.startDate.getMonth();
      const eventStartYear = event.startDate.getFullYear();
      const eventEndMonth = event.endDate.getMonth();
      const eventEndYear = event.endDate.getFullYear();
      
      // Event ends before current month
      if (eventEndYear < year || (eventEndYear === year && eventEndMonth < month)) {
        return false;
      }
      
      // Event starts after current month
      if (eventStartYear > year || (eventStartYear === year && eventStartMonth > month)) {
        return false;
      }
      
      return true;
    };
    
    calendarEvents.forEach((event) => {
      // Skip events that don't intersect with the current month
      if (!isEventInMonth(event, year, month)) {
        return;
      }
      
      // Calculate days in the current month this event spans
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const currentMonthDate = new Date(year, month, 1);
      
      for (let day = 1; day <= daysInMonth; day++) {
        currentMonthDate.setDate(day);
        const dateTime = currentMonthDate.getTime();
        const startTime = event.startDate.getTime();
        const endTime = event.endDate.getTime();
        
        if (dateTime >= startTime && dateTime <= endTime) {
          const key = `${year}-${month}-${day}`;
          const existing = map.get(key) || [];
          existing.push(event);
          map.set(key, existing);
        }
      }
    });
    
    return map;
  }, [calendarEvents, currentDate]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  // Optimized getEventsForDate using pre-computed map
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    return eventsByDate.get(key) || [];
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const today = new Date();

  const renderCalendarDays = () => {
    const days = [];
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Header row
    daysOfWeek.forEach((day) => {
      days.push(
        <div key={day} className="calendar-day-header">
          {day}
        </div>,
      );
    });

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day,
      );
      const isToday = date.toDateString() === today.toDateString();
      const events = getEventsForDate(date);

      days.push(
        <div
          key={day}
          className={`calendar-day ${isToday ? "today" : ""}`}
          onClick={() => onDateClick(date)}
        >
          <div className="day-number">{day}</div>
          <div className="day-events">
            {events.slice(0, 3).map((event, index) => (
              <div
                key={`${event.schedule.id}-${index}`}
                className={`calendar-event status-${event.schedule.status}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(event.schedule);
                }}
                title={`${event.schedule.task_name} - ${event.project.name}`}
              >
                <span className="event-text">{event.schedule.task_name}</span>
              </div>
            ))}
            {events.length > 3 && (
              <div className="more-events">+{events.length - 3} more</div>
            )}
          </div>
        </div>,
      );
    }

    return days;
  };

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button
            onClick={() => navigateMonth("prev")}
            className="nav-button"
            aria-label="Previous month"
          >
            <Icon name="arrow-left" size={18} />
          </button>
          <h2 className="calendar-title">{formatMonth(currentDate)}</h2>
          <button
            onClick={() => navigateMonth("next")}
            className="nav-button"
            aria-label="Next month"
          >
            <Icon name="arrow-right" size={18} />
          </button>
        </div>
        <button onClick={goToToday} className="today-button">
          Today
        </button>
      </div>
      <div className="calendar-grid">{renderCalendarDays()}</div>
    </div>
  );
};

export default Calendar;
