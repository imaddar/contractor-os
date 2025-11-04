import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

interface CrudHookOptions {
  fetchData: () => Promise<void>;
  deleteFn?: (id: number | string) => Promise<void>;
  itemName?: string;
}

/**
 * Custom hook to handle common CRUD operations and state management
 * 
 * @param options.fetchData - Function to fetch data. Should be wrapped with useCallback 
 *                            in the consuming component to prevent infinite re-renders.
 * @param options.deleteFn - Optional function to delete an item by ID (number or string)
 * @param options.itemName - Name of the item type for error messages (default: 'item')
 */
export function useCrudState<T extends { id?: number | string }>(
  options: CrudHookOptions
) {
  const { fetchData, deleteFn, itemName = 'item' } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [deletingItem, setDeletingItem] = useState<T | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initial data fetch
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await fetchData();
      } catch (err) {
        setError(`Failed to fetch ${itemName}s`);
        console.error(`Error fetching ${itemName}s:`, err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fetchData, itemName]);

  // Handle URL parameter for opening modal
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowEditModal(true);
      // Remove only the 'action' parameter while preserving other params
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams);
    }
  }, [searchParams, setSearchParams]);

  const handleDelete = (item: T) => {
    setDeletingItem(item);
    setShowDeleteModal(true);
    setError(null);
  };

  const confirmDelete = async () => {
    if (!deletingItem || !deletingItem.id || !deleteFn) return;
    
    try {
      setIsSubmitting(true);
      await deleteFn(deletingItem.id);
      await fetchData();
      setShowDeleteModal(false);
      setDeletingItem(null);
      setError(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : `Failed to delete ${itemName}`;
      setError(message);
      // Keep modal open to show error
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingItem(null);
    setError(null);
  };

  return {
    loading,
    setLoading,
    error,
    setError,
    showEditModal,
    setShowEditModal,
    showDeleteModal,
    setShowDeleteModal,
    editingItem,
    setEditingItem,
    deletingItem,
    setDeletingItem,
    isSubmitting,
    setIsSubmitting,
    handleDelete,
    confirmDelete,
    cancelDelete,
  };
}
