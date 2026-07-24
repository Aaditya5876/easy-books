import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StudyMaterials from './StudyMaterials';
import Inventory from '../Inventory';
import { useRole } from '@/lib/useRole';

// Merges the former separate "Study Materials" (Academic) and "Inventory" (Finance)
// nav entries into one page/tab, per request — each tab reuses its existing,
// unmodified component so neither feature's logic is duplicated.
//
// This page is reachable by TEACHER (nav/route tag: roles: ['TEACHER']), but the
// Inventory backend is STAFF/ACCOUNTANT/ADMIN-only — stock/equipment tracking isn't
// a teacher concern. Hide the Inventory tab for TEACHER so it isn't a dead 403 tab.
export default function StudyMaterial() {
  const { t } = useTranslation();
  const { isTeacher } = useRole();
  const [activeTab, setActiveTab] = useState('materials');

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-6 pt-6">
          <TabsList>
            <TabsTrigger value="materials">{t('studyMaterial.materialsTab', { defaultValue: 'Study Materials' })}</TabsTrigger>
            {!isTeacher && (
              <TabsTrigger value="inventory">{t('studyMaterial.inventoryTab', { defaultValue: 'Inventory' })}</TabsTrigger>
            )}
          </TabsList>
        </div>
        <TabsContent value="materials" className="mt-0">
          <StudyMaterials />
        </TabsContent>
        {!isTeacher && (
          <TabsContent value="inventory" className="mt-0">
            <Inventory />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
