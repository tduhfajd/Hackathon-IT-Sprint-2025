import { body, param, query } from 'express-validator';

export const createAppealValidators = [
  body('subject')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Subject must be between 5 and 500 characters'),
  
  body('description')
    .trim()
    .isLength({ min: 20, max: 5000 })
    .withMessage('Description must be between 20 and 5000 characters'),
  
  body('category_id')
    .optional()
    .isUUID()
    .withMessage('Category ID must be a valid UUID'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Priority must be one of: low, medium, high, critical'),
  
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must not exceed 500 characters')
];

export const updateAppealValidators = [
  body('subject')
    .optional()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Subject must be between 5 and 500 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ min: 20, max: 5000 })
    .withMessage('Description must be between 20 and 5000 characters'),
  
  body('category_id')
    .optional()
    .isUUID()
    .withMessage('Category ID must be a valid UUID'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Priority must be one of: low, medium, high, critical'),
  
  body('status')
    .optional()
    .isIn(['new', 'processing', 'completed', 'rejected', 'in_progress', 'resolved'])
    .withMessage('Status must be one of: new, processing, completed, rejected, in_progress, resolved'),
  
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must not exceed 500 characters')
];

export const appealIdValidator = [
  param('id')
    .isUUID()
    .withMessage('Appeal ID must be a valid UUID')
];

export const trackingNumberValidator = [
  param('trackingNumber')
    .matches(/^AP[A-Z0-9]+$/)
    .withMessage('Invalid tracking number format')
];

export const appealQueryValidators = [
  query('status')
    .optional()
    .isIn(['new', 'processing', 'completed', 'rejected', 'in_progress', 'resolved'])
    .withMessage('Status must be one of: new, processing, completed, rejected, in_progress, resolved'),
  
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Priority must be one of: low, medium, high, critical'),
  
  query('category_id')
    .optional()
    .isUUID()
    .withMessage('Category ID must be a valid UUID'),
  
  query('user_id')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid ISO 8601 date'),
  
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid ISO 8601 date'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search term must be between 2 and 100 characters'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer')
];