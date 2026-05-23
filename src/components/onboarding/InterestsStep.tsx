import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useInterestCategories } from '@/hooks/useInterestCategories';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface InterestsStepProps {
  selectedInterests: string[];
  onToggleInterest: (interestId: string) => void;
  onNext: () => void;
  onBack: () => void;
  categoryIndex: number;
  setCategoryIndex: (index: number) => void;
}

export function InterestsStep({ selectedInterests, onToggleInterest, onNext, onBack, categoryIndex, setCategoryIndex }: InterestsStepProps) {
  const { categories, loading } = useInterestCategories();

  const currentCategory = categories[categoryIndex];

  const getSelectedInCategory = useCallback((catIndex: number) => {
    if (!categories[catIndex]) return [];
    return categories[catIndex].interests
      .filter(i => selectedInterests.includes(i.id))
      .map(i => i.id);
  }, [categories, selectedInterests]);

  const handleSelectTag = useCallback((interestId: string, isNoneOption: boolean) => {
    const selectedInCurrent = getSelectedInCategory(categoryIndex);

    if (isNoneOption) {
      // "Nenhuma delas" — deseleciona tudo da categoria e avança
      selectedInCurrent.forEach(id => onToggleInterest(id));
      if (!selectedInCurrent.includes(interestId)) {
        onToggleInterest(interestId);
      }
      setTimeout(() => {
        if (categoryIndex < categories.length - 1) {
          setCategoryIndex(categoryIndex + 1);
        } else {
          onNext();
        }
      }, 200);
      return;
    }

    // Se "Nenhuma delas" estava selecionada, remove ela primeiro
    const noneOption = currentCategory?.interests.find(i =>
      i.name.toLowerCase().includes('nenhum') || i.name.toLowerCase().includes('nenhuma')
    );
    if (noneOption && selectedInCurrent.includes(noneOption.id)) {
      onToggleInterest(noneOption.id);
    }

    // Toggle normal
    onToggleInterest(interestId);
  }, [categoryIndex, categories, currentCategory, getSelectedInCategory, onToggleInterest, onNext, setCategoryIndex]);

  const handleContinue = useCallback(() => {
    if (categoryIndex < categories.length - 1) {
      setCategoryIndex(categoryIndex + 1);
    } else {
      onNext();
    }
  }, [categoryIndex, categories.length, setCategoryIndex, onNext]);

  const handleBack = useCallback(() => {
    if (categoryIndex > 0) {
      setCategoryIndex(categoryIndex - 1);
    } else {
      onBack();
    }
  }, [categoryIndex, onBack, setCategoryIndex]);

  if (loading || categories.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const selectedInCurrent = getSelectedInCategory(categoryIndex);

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* Progress bar */}
        <div>
          <div className="w-full bg-muted rounded-full h-1.5 mb-2">
            <div
              className="bg-accent h-1.5 rounded-full transition-all"
              style={{ width: `${((categoryIndex + 1) / categories.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{categoryIndex + 1} de {categories.length}</p>
        </div>

        {/* Category title */}
        <div>
          <h2 className="text-lg font-semibold text-foreground">{currentCategory.name}</h2>
          {categoryIndex === 0 ? (
            <p className="text-sm text-muted-foreground">
              Suas escolhas ajudam a encontrar pessoas com interesses parecidos — ninguém verá essas informações no seu perfil.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Escolha quantas quiser</p>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {currentCategory.interests.map((interest) => {
            const isSelected = selectedInCurrent.includes(interest.id);
            const isNoneOption = interest.name.toLowerCase().includes('nenhum') || interest.name.toLowerCase().includes('nenhuma');
            return (
              <button
                key={interest.id}
                onClick={() => handleSelectTag(interest.id, isNoneOption)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                {interest.name}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Button
            size="sm"
            onClick={handleContinue}
            className="ml-auto bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {categoryIndex < categories.length - 1 ? 'Continuar' : 'Concluir'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
