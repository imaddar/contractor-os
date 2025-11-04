import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

interface CrudHookOptions {
  fetchData: () => Promise<void>;
  deleteFn?: (id: number) => Promise<void>;
  itemName?: string;
}

/**
 * Custom hook to handle common CRUD operations and state management
 */
export function useCrudState<T extends { id?: number }>(
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
      setSearchParams({});
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
      console.log(`Deleting ${itemName}:`, deletingItem.id);
      await deleteFn(deletingItem.id);
      console.log(`${itemName} deleted successfully`);
      await fetchData();
      setShowDeleteModal(false);
      setDeletingItem(null);
      setError(null);
    } catch (err: unknown) {
      console.error(`Error deleting ${itemName}:`, err);
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
