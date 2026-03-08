export interface InterestCategory {
  id: string;
  name: string;
  sort_order: number;
  interests: Interest[];
}

export interface Interest {
  id: string;
  category_id: string;
  name: string;
  slug: string;
}

export interface UserInterest {
  user_id: string;
  interest_id: string;
}
