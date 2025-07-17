'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, DollarSign, Calendar, User, Building } from 'lucide-react';
import { isAuthenticated, getToken, redirectToLogin } from '@/lib/auth';

interface Opportunity {
  id: string;
  name: string;
  description: string;
  stage: string;
  opportunity_type: string;
  lead_source: string;
  amount: string;
  probability: number;
  expected_revenue: string;
  close_date: string;
  next_step: string;
  owner_name: string;
  company_name: string;
  contact_name: string;
  created_at: string;
}

interface KanbanColumn {
  stage: string;
  opportunities: Opportunity[];
  total: number;
}

const stages = [
  { key: 'PROSPECTING', label: 'Проспектинг', color: 'bg-blue-100' },
  { key: 'QUALIFICATION', label: 'Квалификация', color: 'bg-yellow-100' },
  { key: 'PROPOSAL', label: 'Предложение', color: 'bg-orange-100' },
  { key: 'NEGOTIATION', label: 'Переговоры', color: 'bg-purple-100' },
  { key: 'CLOSED_WON', label: 'Выиграно', color: 'bg-green-100' },
  { key: 'CLOSED_LOST', label: 'Проиграно', color: 'bg-red-100' },
];

export default function OpportunitiesPage() {
  const router = useRouter();
  const [kanbanData, setKanbanData] = useState<KanbanColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newOpportunity, setNewOpportunity] = useState({
    name: '',
    description: '',
    stage: 'PROSPECTING',
    opportunity_type: 'NEW_BUSINESS',
    lead_source: 'WEBSITE',
    amount: '',
    probability: 25,
    close_date: '',
    next_step: '',
  });

  useEffect(() => {
    if (!isAuthenticated()) {
      redirectToLogin();
      return;
    }
    fetchKanbanData();
  }, []);

  const fetchKanbanData = async () => {
    const token = getToken();
    if (!token) {
      redirectToLogin();
      return;
    }
    
    try {

      const response = await fetch('http://localhost:3001/api/v1/opportunities/kanban', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setKanbanData(data);
      } else {
        console.error('Failed to fetch kanban data');
      }
    } catch (error) {
      console.error('Error fetching kanban data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOpportunity = async () => {
    console.log('🚀 Create button clicked!');
    
    const token = getToken();
    console.log('🔑 Token:', token ? 'exists' : 'missing');
    
    if (!token) {
      console.error('❌ No token found, redirecting to login');
      redirectToLogin();
      return;
    }
    
    console.log('📝 Creating opportunity with data:', newOpportunity);
    
    try {
      const response = await fetch('http://localhost:3001/api/v1/opportunities/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newOpportunity),
      });

      console.log('📡 Response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Opportunity created:', result);
        setShowCreateDialog(false);
        setNewOpportunity({
          name: '',
          description: '',
          stage: 'PROSPECTING',
          opportunity_type: 'NEW_BUSINESS',
          lead_source: 'WEBSITE',
          amount: '',
          probability: 25,
          close_date: '',
          next_step: '',
        });
        fetchKanbanData();
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to create opportunity:', response.status, errorText);
      }
    } catch (error) {
      console.error('💥 Error creating opportunity:', error);
    }
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Сделки</h1>
          <p className="text-gray-600">Управление воронкой продаж</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Новая сделка
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Создать новую сделку</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Название</Label>
                  <Input
                    id="name"
                    value={newOpportunity.name}
                    onChange={(e) => setNewOpportunity({...newOpportunity, name: e.target.value})}
                    placeholder="Название сделки"
                  />
                </div>
                <div>
                  <Label htmlFor="stage">Стадия</Label>
                  <Select value={newOpportunity.stage} onValueChange={(value) => setNewOpportunity({...newOpportunity, stage: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.key} value={stage.key}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={newOpportunity.description}
                  onChange={(e) => setNewOpportunity({...newOpportunity, description: e.target.value})}
                  placeholder="Описание сделки"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="amount">Сумма</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={newOpportunity.amount}
                    onChange={(e) => setNewOpportunity({...newOpportunity, amount: e.target.value})}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="probability">Вероятность (%)</Label>
                  <Input
                    id="probability"
                    type="number"
                    min="0"
                    max="100"
                    value={newOpportunity.probability}
                    onChange={(e) => setNewOpportunity({...newOpportunity, probability: parseInt(e.target.value)})}
                  />
                </div>
                <div>
                  <Label htmlFor="close_date">Дата закрытия</Label>
                  <Input
                    id="close_date"
                    type="date"
                    value={newOpportunity.close_date}
                    onChange={(e) => setNewOpportunity({...newOpportunity, close_date: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="next_step">Следующий шаг</Label>
                <Input
                  id="next_step"
                  value={newOpportunity.next_step}
                  onChange={(e) => setNewOpportunity({...newOpportunity, next_step: e.target.value})}
                  placeholder="Что нужно сделать дальше?"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Отмена
              </Button>
              <Button 
                onClick={() => {
                  console.log('🎯 Create button clicked in onClick handler');
                  handleCreateOpportunity();
                }}
              >
                Создать
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-6 gap-4">
        {stages.map((stage) => {
          const columnData = kanbanData.find(col => col.stage === stage.key);
          const opportunities = columnData?.opportunities || [];
          
          return (
            <div key={stage.key} className="space-y-4">
              <div className={`p-4 rounded-lg ${stage.color}`}>
                <h3 className="font-semibold text-gray-800">{stage.label}</h3>
                <p className="text-sm text-gray-600">{opportunities.length} сделок</p>
              </div>
              
              <div className="space-y-3">
                {opportunities.map((opportunity) => (
                  <Card key={opportunity.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">{opportunity.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          {opportunity.opportunity_type}
                        </Badge>
                        <span className="text-xs text-gray-500">{opportunity.probability}%</span>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center text-xs text-gray-600">
                          <DollarSign className="w-3 h-3 mr-1" />
                          {formatCurrency(opportunity.amount)}
                        </div>
                        
                        {opportunity.close_date && (
                          <div className="flex items-center text-xs text-gray-600">
                            <Calendar className="w-3 h-3 mr-1" />
                            {formatDate(opportunity.close_date)}
                          </div>
                        )}
                        
                        {opportunity.owner_name && (
                          <div className="flex items-center text-xs text-gray-600">
                            <User className="w-3 h-3 mr-1" />
                            {opportunity.owner_name}
                          </div>
                        )}
                      </div>
                      
                      {opportunity.next_step && (
                        <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                          <strong>Следующий шаг:</strong> {opportunity.next_step}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 