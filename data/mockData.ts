// Mock data for Kabadiwala Connect prototype

export interface Collector {
  id: string
  name: string
  phone: string
  email: string
  location: string
  avatar?: string
  totalCollected: number
  totalEarnings: number
  completedHandovers: number
  verificationStatus: 'pending' | 'verified' | 'rejected'
  registrationDate: string
  rating: number
}

export interface Recycler {
  id: string
  name: string
  registrationId: string
  location: string
  phone: string
  email: string
  distance?: number
  acceptedMaterials: string[]
  operatingHours: string
  verified: boolean
  rating: number
  processingCategories: string[]
  about?: string
  latitude?: number
  longitude?: number
}

export interface Material {
  id: string
  name: string
  category: string
  indicativePrice: number
  unit: string
  priceTrend: 'up' | 'down' | 'stable'
  icon?: string
  description?: string
  acceptedByRecyclers?: number
}

export interface WasteRequest {
  id: string
  collectorId: string
  recyclerId: string
  material: string
  quantity: number
  weight: number
  estimatedValue: number
  status: 'pending' | 'accepted' | 'in-transit' | 'completed' | 'rejected'
  createdDate: string
  handoverDate?: string
  notes?: string
}

export interface Transaction {
  id: string
  requestId: string
  collectorName: string
  recyclerName: string
  material: string
  weight: number
  amount: number
  status: 'completed' | 'pending' | 'failed'
  date: string
}

export interface Notification {
  id: string
  userId: string
  type: 'request' | 'payment' | 'system' | 'info'
  title: string
  message: string
  read: boolean
  createdAt: string
  actionUrl?: string
}

// Mock collectors
export const mockCollectors: Collector[] = [
  {
    id: 'col_001',
    name: 'Ravi Kumar',
    phone: '+91 9876543210',
    email: 'ravi.kumar@example.com',
    location: 'Charminar, Hyderabad',
    totalCollected: 1284,
    totalEarnings: 48650,
    completedHandovers: 27,
    verificationStatus: 'verified',
    registrationDate: '2026-01-15',
    rating: 4.8,
  },
]

// Mock recyclers
export const mockRecyclers: Recycler[] = [
  {
    id: 'rec_001',
    name: 'GreenCycle Recycling',
    registrationId: 'GR-HYD-2026-001',
    location: 'Miyapur Industrial Area, Hyderabad',
    phone: '+91 9876543211',
    email: 'info@greencycle.com',
    distance: 3.2,
    acceptedMaterials: ['Computers', 'Laptops', 'Mobile Phones', 'Cables'],
    operatingHours: '9 AM - 6 PM, Mon-Sat',
    verified: true,
    rating: 4.9,
    processingCategories: ['E-waste Dismantling', 'Material Recovery', 'Precious Metal Extraction'],
    about: 'Verified e-waste recycling facility focused on responsible collection, processing and material recovery.',
    latitude: 17.4909,
    longitude: 78.3589,
  },
  {
    id: 'rec_002',
    name: 'EcoTech Recyclers',
    registrationId: 'ET-HYD-2026-002',
    location: 'Secunderabad, Hyderabad',
    phone: '+91 9876543212',
    email: 'contact@ecotech.com',
    distance: 5.1,
    acceptedMaterials: ['TVs', 'Monitors', 'Batteries', 'Printers'],
    operatingHours: '8 AM - 7 PM, Mon-Sun',
    verified: true,
    rating: 4.7,
    processingCategories: ['Screen Panel Recycling', 'Battery Processing', 'Certified Disposal'],
    latitude: 17.3550,
    longitude: 78.4744,
  },
  {
    id: 'rec_003',
    name: 'ReNew E-Waste Solutions',
    registrationId: 'RES-HYD-2026-003',
    location: 'Begumpet, Hyderabad',
    phone: '+91 9876543213',
    email: 'hello@renewewaste.com',
    distance: 4.8,
    acceptedMaterials: ['All Electronics', 'Appliances', 'Cables', 'Batteries', 'Computers'],
    operatingHours: '10 AM - 5 PM, Mon-Fri',
    verified: true,
    rating: 4.6,
    processingCategories: ['Comprehensive E-waste Management', 'Certified Refurbishment'],
    latitude: 17.3595,
    longitude: 78.4505,
  },
]

// Mock materials
export const mockMaterials: Material[] = [
  {
    id: 'mat_001',
    name: 'Laptop Scrap',
    category: 'Computers',
    indicativePrice: 110,
    unit: 'per kg',
    priceTrend: 'up',
    description: 'Used and broken laptops, no condition requirement',
    acceptedByRecyclers: 12,
  },
  {
    id: 'mat_002',
    name: 'Copper Cable',
    category: 'Cables',
    indicativePrice: 620,
    unit: 'per kg',
    priceTrend: 'stable',
    description: 'Copper wires and cables',
    acceptedByRecyclers: 18,
  },
  {
    id: 'mat_003',
    name: 'Mobile Phones',
    category: 'Mobile Devices',
    indicativePrice: 280,
    unit: 'per kg',
    priceTrend: 'down',
    description: 'Old and damaged mobile phones',
    acceptedByRecyclers: 15,
  },
  {
    id: 'mat_004',
    name: 'Lead Battery',
    category: 'Batteries',
    indicativePrice: 95,
    unit: 'per kg',
    priceTrend: 'up',
    description: 'Lead acid batteries from UPS, inverters',
    acceptedByRecyclers: 20,
  },
  {
    id: 'mat_005',
    name: 'Monitor Panel',
    category: 'Displays',
    indicativePrice: 45,
    unit: 'per kg',
    priceTrend: 'stable',
    description: 'CRT and LCD monitors',
    acceptedByRecyclers: 8,
  },
  {
    id: 'mat_006',
    name: 'Printer Circuit Board',
    category: 'Printers',
    indicativePrice: 890,
    unit: 'per kg',
    priceTrend: 'up',
    description: 'Printer motherboards and components',
    acceptedByRecyclers: 10,
  },
  {
    id: 'mat_007',
    name: 'Mixed Appliances',
    category: 'Appliances',
    indicativePrice: 35,
    unit: 'per kg',
    priceTrend: 'stable',
    description: 'Old microwaves, coolers, fans',
    acceptedByRecyclers: 14,
  },
]

// Mock requests
export const mockRequests: WasteRequest[] = [
  {
    id: 'req_001',
    collectorId: 'col_001',
    recyclerId: 'rec_001',
    material: 'Laptop Scrap',
    quantity: 5,
    weight: 18,
    estimatedValue: 1980,
    status: 'completed',
    createdDate: '2026-09-10',
    handoverDate: '2026-09-11',
    notes: 'Successful handover and payment received',
  },
  {
    id: 'req_002',
    collectorId: 'col_001',
    recyclerId: 'rec_002',
    material: 'Mobile Phones',
    quantity: 12,
    weight: 8,
    estimatedValue: 2240,
    status: 'accepted',
    createdDate: '2026-09-15',
    notes: 'Awaiting handover appointment',
  },
  {
    id: 'req_003',
    collectorId: 'col_001',
    recyclerId: 'rec_003',
    material: 'Copper Cable',
    quantity: 3,
    weight: 25,
    estimatedValue: 15500,
    status: 'pending',
    createdDate: '2026-09-17',
    notes: 'Waiting for recycler response',
  },
  {
    id: 'req_004',
    collectorId: 'col_001',
    recyclerId: 'rec_001',
    material: 'Lead Battery',
    quantity: 2,
    weight: 40,
    estimatedValue: 3800,
    status: 'in-transit',
    createdDate: '2026-09-16',
    handoverDate: '2026-09-19',
    notes: 'In transit to recycler facility',
  },
]

// Mock transactions
export const mockTransactions: Transaction[] = [
  {
    id: 'txn_001',
    requestId: 'req_001',
    collectorName: 'Ravi Kumar',
    recyclerName: 'GreenCycle Recycling',
    material: 'Laptop Scrap',
    weight: 18,
    amount: 1980,
    status: 'completed',
    date: '2026-09-11',
  },
  {
    id: 'txn_002',
    requestId: 'req_005',
    collectorName: 'Ravi Kumar',
    recyclerName: 'EcoTech Recyclers',
    material: 'Monitor Panel',
    weight: 22,
    amount: 990,
    status: 'completed',
    date: '2026-09-12',
  },
  {
    id: 'txn_003',
    requestId: 'req_006',
    collectorName: 'Ravi Kumar',
    recyclerName: 'ReNew E-Waste Solutions',
    material: 'Printer Circuit Board',
    weight: 5,
    amount: 4450,
    status: 'completed',
    date: '2026-09-13',
  },
  {
    id: 'txn_004',
    requestId: 'req_007',
    collectorName: 'Ravi Kumar',
    recyclerName: 'GreenCycle Recycling',
    material: 'Cables',
    weight: 12,
    amount: 7440,
    status: 'pending',
    date: '2026-09-18',
  },
]

// Mock notifications
export const mockNotifications: Notification[] = [
  {
    id: 'notif_001',
    userId: 'col_001',
    type: 'request',
    title: 'Request Accepted',
    message: 'GreenCycle Recycling accepted your handover request for Laptop Scrap.',
    read: false,
    createdAt: '2026-09-17T14:30:00Z',
    actionUrl: '/collector/requests/req_001',
  },
  {
    id: 'notif_002',
    userId: 'col_001',
    type: 'payment',
    title: 'Payment Received',
    message: '₹1,980 payment marked as completed for Laptop Scrap handover.',
    read: true,
    createdAt: '2026-09-11T16:45:00Z',
  },
  {
    id: 'notif_003',
    userId: 'col_001',
    type: 'info',
    title: 'Verification Complete',
    message: 'Your collector profile has been verified successfully.',
    read: true,
    createdAt: '2026-09-01T09:15:00Z',
  },
]

// Dashboard statistics
export const mockDashboardStats = {
  collector: {
    totalCollected: 1284,
    pendingRequests: 4,
    completedHandovers: 27,
    totalEarnings: 48650,
    weeklyCollection: [
      { date: 'Mon', value: 145 },
      { date: 'Tue', value: 189 },
      { date: 'Wed', value: 142 },
      { date: 'Thu', value: 176 },
      { date: 'Fri', value: 198 },
      { date: 'Sat', value: 212 },
      { date: 'Sun', value: 165 },
    ],
    materialDistribution: [
      { name: 'Computers', value: 380 },
      { name: 'Mobile Phones', value: 245 },
      { name: 'Cables', value: 398 },
      { name: 'Batteries', value: 261 },
    ],
  },
  recycler: {
    pendingRequests: 8,
    acceptedToday: 5,
    completedHandovers: 156,
    totalProcessed: 3420,
    monthlyVolume: [
      { month: 'Aug', value: 2800 },
      { month: 'Sep', value: 3100 },
      { month: 'Oct', value: 3420 },
    ],
  },
  admin: {
    registeredCollectors: 1200,
    verifiedRecyclers: 35,
    totalEWasteCollected: 156400,
    completedHandovers: 4230,
    platformTransactions: 648200,
  },
}

// Recent activity
export const mockRecentActivity = [
  { id: 1, type: 'handover_completed', description: 'Laptop handover completed with GreenCycle Recycling', time: '2 hours ago' },
  { id: 2, type: 'request_accepted', description: 'Recycler accepted your handover request', time: '5 hours ago' },
  { id: 3, type: 'waste_added', description: 'Added 12 Mobile Phones to inventory', time: '1 day ago' },
  { id: 4, type: 'payment_received', description: '₹2,450 payment received', time: '2 days ago' },
]

// User credentials for demo login
export const demoCredentials = {
  collector: {
    email: 'ravi@demo.com',
    password: 'demo123',
    role: 'collector',
  },
  recycler: {
    email: 'greencycle@demo.com',
    password: 'demo123',
    role: 'recycler',
  },
  admin: {
    email: 'admin@demo.com',
    password: 'demo123',
    role: 'admin',
  },
}
