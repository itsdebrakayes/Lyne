const _jsxFileName = "";import React, { useState } from 'react';
import { Clock, TrendingUp } from 'lucide-react';
import { ServiceStatBox } from '@/components/admin/ServiceStatBox';
import { StatsCard } from '@/components/admin/StatsCard';
import { QueueTable } from '@/components/admin/QueueTable';
import { QueueListItem } from '@/components/admin/QueueListItem';
import { ActiveSessionCard } from '@/components/admin/ActiveSessionCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQueueMock } from '@/hooks/useQueueMock';
import { getServices, getStats, getCustomerById, getServiceById, getAllActiveQueue } from '@/lib/mockDataUtils';

export default function Dashboard() {
  const [serviceFilter, setServiceFilter] = useState('all');
  const { queueEntries, activeSessions } = useQueueMock();
  const services = getServices();
  const stats = getStats();

  const waitingQueue = queueEntries.filter(entry => entry.status === 'waiting');
  const servingQueue = queueEntries.filter(entry => entry.status === 'serving');

  const filteredQueue = serviceFilter === 'all' 
    ? waitingQueue 
    : waitingQueue.filter(entry => entry.serviceId === serviceFilter);

  const nextInQueue = waitingQueue.slice(0, 8);

  return (
    React.createElement('div', { className: "space-y-8"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 30}}
      /* Header */
      , React.createElement('div', { className: "flex items-center justify-between"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 32}}
        , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 33}}
          , React.createElement('h1', { className: "text-4xl font-bold text-foreground"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 34}}, "Dashboard")
          , React.createElement('p', { className: "text-muted-foreground mt-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 35}}, "Real-time queue management overview")
        )
        , React.createElement('div', { className: "flex gap-3"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 37}}
          , React.createElement(Button, { variant: "outline" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 38}}, "Export Report")
          , React.createElement(Button, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 39}}, "Call Next")
        )
      )

      /* Currently Serving Section */
      , React.createElement('div', { className: "space-y-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 43}}
        , React.createElement('div', { className: "flex items-center justify-between"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 44}}
          , React.createElement('h2', { className: "text-2xl font-semibold text-foreground"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 45}}, "Currently Serving")
          , React.createElement('div', { className: "flex items-center gap-2 text-sm text-muted-foreground"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 46}}
            , React.createElement(TrendingUp, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 47}} )
            , React.createElement('span', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 48}}, activeSessions.length, " active sessions")
          )
        )

        , React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 51}}
          , activeSessions.length === 0 ? (
            React.createElement('div', { className: "glass rounded-xl p-8 text-center col-span-full"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 53}}
              , React.createElement('p', { className: "text-muted-foreground"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 54}}, "No active service sessions")
            )
          ) : (
            activeSessions.map(session => {
              const queueEntry = servingQueue.find(q => q.id === session.queueEntryId);
              return queueEntry ? (
                React.createElement(ActiveSessionCard, {
                  key: session.id,
                  session: session,
                  queueEntry: queueEntry, __self: this, __source: {fileName: _jsxFileName, lineNumber: 59}}
                )
              ) : null;
            })
          )
        )
      )

      /* Top Stats Section */
      , React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 71}}
        , services.map((service) => (
          React.createElement(ServiceStatBox, {
            key: service.id,
            count: stats.serviceStats[service.id]?.waiting || 0,
            label: service.name,
            icon: service.icon, __self: this, __source: {fileName: _jsxFileName, lineNumber: 73}}
          )
        ))
        
        , React.createElement(StatsCard, {
          title: "Average Wait Time",
          value: `${stats.averageWaitTime}m`,
          subtitle: "Across all services",
          icon: Clock,
          gradient: true, __self: this, __source: {fileName: _jsxFileName, lineNumber: 81}}
        )
      )

      /* Main Content Grid */
      , React.createElement('div', { className: "grid grid-cols-1 lg:grid-cols-3 gap-6"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 63}}
        /* Left Column - Next in Queue Table */
        , React.createElement('div', { className: "lg:col-span-2 space-y-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 65}}
          , React.createElement('div', { className: "flex items-center justify-between"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 66}}
            , React.createElement('h2', { className: "text-2xl font-semibold text-foreground"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 67}}, "Next in Queue")
            , React.createElement(Input, { placeholder: "Search...", className: "w-64" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 68}} )
          )
          , React.createElement(QueueTable, { entries: nextInQueue, __self: this, __source: {fileName: _jsxFileName, lineNumber: 70}} )
        )

        /* Right Column - Live Queue Panel */
        , React.createElement('div', { className: "space-y-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 74}}
          , React.createElement('div', { className: "flex items-center justify-between"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 75}}
            , React.createElement('h2', { className: "text-2xl font-semibold text-foreground"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 76}}, "Live Queue")
            , React.createElement(Select, { value: serviceFilter, onValueChange: setServiceFilter, __self: this, __source: {fileName: _jsxFileName, lineNumber: 77}}
              , React.createElement(SelectTrigger, { className: "w-[160px]"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 78}}
                , React.createElement(SelectValue, { placeholder: "All Services" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 79}} )
              )
              , React.createElement(SelectContent, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 81}}
                , React.createElement(SelectItem, { value: "all", __self: this, __source: {fileName: _jsxFileName, lineNumber: 82}}, "All Services")
                , services.map(service => (
                  React.createElement(SelectItem, { key: service.id, value: service.id, __self: this, __source: {fileName: _jsxFileName, lineNumber: 84}}
                    , service.name
                  )
                ))
              )
            )
          )
          
          , React.createElement('div', { className: "glass rounded-xl p-4 space-y-3 max-h-[500px] overflow-y-auto"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 92}}
            , filteredQueue.length === 0 ? (
              React.createElement('p', { className: "text-center text-muted-foreground py-8"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 94}}, "No customers in queue")
            ) : (
              filteredQueue.slice(0, 10).map(entry => {
                const customer = getCustomerById(entry.customerId);
                const service = getServiceById(entry.serviceId);
                return customer && service ? (
                  React.createElement(QueueListItem, {
                    key: entry.id,
                    customer: customer,
                    service: service,
                    ticketNumber: entry.ticketNumber,
                    position: entry.position, __self: this, __source: {fileName: _jsxFileName, lineNumber: 100}}
                  )
                ) : null;
              })
            )
          )
        )
      )
    )
  );
}
