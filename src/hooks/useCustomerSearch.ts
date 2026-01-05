import { useState, useMemo } from 'react';
import { getCustomers, filterCustomers } from '@/lib/mockDataUtils';

export const useCustomerSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('recent');
  
  const allCustomers = useMemo(() => getCustomers(), []);
  
  const filteredCustomers = useMemo(() => {
    return filterCustomers(allCustomers, filterType, searchTerm);
  }, [allCustomers, filterType, searchTerm]);

  return {
    customers: filteredCustomers,
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
  };
};
