import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StudyMaterials from './StudyMaterials';
import Inventory from '../Inventory';

// Merges the former separate "Study Materials" (Academic) and "Inventory" (Finance)
// nav entries into one page/tab, per request — each tab reuses its existing,
// unmodified component so neither feature's logic is duplicated.
export default function StudyMaterial() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('materials');

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-6 pt-6">
          <TabsList>
            <TabsTrigger value="materials">{t('studyMaterial.materialsTab', { defaultValue: 'Study Materials' })}</TabsTrigger>
            <TabsTrigger value="inventory">{t('studyMaterial.inventoryTab', { defaultValue: 'Inventory' })}</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="materials" className="mt-0">
          <StudyMaterials />
        </TabsContent>
        <TabsContent value="inventory" className="mt-0">
          <Inventory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
