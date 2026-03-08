import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useInterestCategories } from '@/hooks/useInterestCategories';
import { Check, Loader2 } from 'lucide-react';

const MIN_INTERESTS = 3;
const MAX_INTERESTS = 10;
const MAX_PER_CATEGORY = 4;

interface InterestsStepProps {
  selectedInterests: string[];
  onToggleInterest: (interestId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function InterestsStep({ selectedInterests, onToggleInterest, onNext, onBack }: InterestsStepProps) {
  const { categories, loading } = useInterestCategories();

  const getCategoryCount = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return 0;
    return category.interests.filter(i => selectedInterests.includes(i.id)).length;
  };

  const handleToggle = (interestId: string, categoryId: string) => {
    const isSelected = selectedInterests.includes(interestId);
    
    if (!isSelected) {
      if (selectedInterests.length >= MAX_INTERESTS) return;
      if (getCategoryCount(categoryId) >= MAX_PER_CATEGORY) return;
    }
    
    onToggleInterest(interestId);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seus interesses</CardTitle>
        <CardDescription>
          Selecione de {MIN_INTERESTS} a {MAX_INTERESTS} interesses (máx. {MAX_PER_CATEGORY} por categoria)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {categories.map((category) => {
          const catCount = getCategoryCount(category.id);
          return (
            <div key={category.id}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">{category.name}</h3>
                {catCount > 0 && (
                  <span className="text-xs text-muted-foreground">{catCount}/{MAX_PER_CATEGORY}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {category.interests.map((interest) => {
                  const isSelected = selectedInterests.includes(interest.id);
                  const categoryFull = catCount >= MAX_PER_CATEGORY && !isSelected;
                  const maxReached = selectedInterests.length >= MAX_INTERESTS && !isSelected;
                  const disabled = categoryFull || maxReached;

                  return (
                    <Badge
                      key={interest.id}
                      variant={isSelected ? 'default' : 'outline'}
                      className={`cursor-pointer transition-all py-2 px-3 ${
                        isSelected
                          ? 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
                          : disabled
                            ? 'opacity-40 cursor-not-allowed'
                            : 'hover:bg-muted'
                      }`}
                      onClick={() => !disabled && handleToggle(interest.id, category.id)}
                    >
                      {interest.name}
                      {isSelected && <Check className="ml-1 h-3 w-3" />}
                    </Badge>
                  );
                })}
              </div>
            </div>
          );
        })}

        <p className="text-sm text-muted-foreground">
          {selectedInterests.length} de {MIN_INTERESTS}–{MAX_INTERESTS} selecionados
        </p>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Voltar
          </Button>
          <Button
            onClick={onNext}
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={selectedInterests.length < MIN_INTERESTS}
          >
            Continuar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
