export function invalidateAfterProductChange(queryClient, userId, spaceId, productId) {
  queryClient.invalidateQueries({ queryKey: ['products', userId, spaceId] });
  queryClient.invalidateQueries({ queryKey: ['space', userId, spaceId] });
  queryClient.invalidateQueries({ queryKey: ['spaces', userId] });
  queryClient.invalidateQueries({ queryKey: ['dashboard', userId] });
  queryClient.invalidateQueries({ queryKey: ['space-preview-products', userId, spaceId] });
  if (productId) queryClient.invalidateQueries({ queryKey: ['product', userId, productId] });
}

export function invalidateAfterPreferenceChange(queryClient, userId) {
  queryClient.invalidateQueries({ queryKey: ['notification-preferences', userId] });
  queryClient.invalidateQueries({ queryKey: ['dashboard', userId] });
  queryClient.invalidateQueries({ queryKey: ['spaces', userId] });
  queryClient.invalidateQueries({ queryKey: ['space', userId] });
  queryClient.invalidateQueries({ queryKey: ['products', userId] });
  queryClient.invalidateQueries({ queryKey: ['product', userId] });
  queryClient.invalidateQueries({ queryKey: ['space-preview-products', userId] });
  queryClient.invalidateQueries({ queryKey: ['members', userId] });
}
