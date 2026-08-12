import { createBrowserRouter, Navigate } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout';
import PublicLayout from '../layouts/PublicLayout';
import AdminBookingsPage from '../pages/AdminBookingsPage/AdminBookingsPage';
import AdminEventTypeFormPage from '../pages/AdminEventTypeFormPage/AdminEventTypeFormPage';
import AdminEventTypesPage from '../pages/AdminEventTypesPage/AdminEventTypesPage';
import BookingPage from '../pages/BookingPage/BookingPage';
import BookingSuccessPage from '../pages/BookingSuccessPage/BookingSuccessPage';
import EventTypesPage from '../pages/EventTypesPage/EventTypesPage';
import LandingPage from '../pages/LandingPage/LandingPage';
import NotFoundPage from '../pages/NotFoundPage/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'book', element: <EventTypesPage /> },
      { path: 'book/success', element: <BookingSuccessPage /> },
      { path: 'book/:eventTypeId', element: <BookingPage /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/bookings" replace /> },
      { path: 'bookings', element: <AdminBookingsPage /> },
      { path: 'event-types', element: <AdminEventTypesPage /> },
      { path: 'event-types/new', element: <AdminEventTypeFormPage /> },
      { path: 'event-types/:eventTypeId/edit', element: <AdminEventTypeFormPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
