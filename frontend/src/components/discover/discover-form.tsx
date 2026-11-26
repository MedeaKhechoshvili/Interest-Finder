"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  categories,
  categoryFilters,
  discoverUrl,
  maxFilterLength,
  maxQueryLength,
  yearError,
} from "@/lib/catalog";
import type { Category, DiscoverParams, FilterName } from "@/lib/catalog";

interface DiscoverFormProps {
  initial: DiscoverParams;
}

export default function DiscoverForm(props: DiscoverFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState(props.initial.q);
  const [filters, setFilters] = useState(props.initial.filters);
  const [errors, setErrors] = useState<Partial<Record<FilterName, string>>>({});
  const category = props.initial.category;

  // when the url changes (for example with the back button), show its search
  const searchKey = discoverUrl({ ...props.initial, page: 1 });
  const [shownKey, setShownKey] = useState(searchKey);

  if (shownKey !== searchKey) {
    setShownKey(searchKey);
    setQuery(props.initial.q);
    setFilters(props.initial.filters);
    setErrors({});
  }

  // changing the category starts a new search on page 1
  function chooseCategory(value: Category | null) {
    router.push(
      discoverUrl({ q: query.trim(), category: value, page: 1, filters: {} }),
    );
  }

  function changeFilter(name: FilterName, value: string) {
    const nextFilters = { ...filters };
    nextFilters[name] = value;
    setFilters(nextFilters);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Partial<Record<FilterName, string>> = {};
    const cleanFilters: Partial<Record<FilterName, string>> = {};
    let valid = true;

    if (category) {
      for (const field of categoryFilters[category]) {
        const value = (filters[field.name] || "").trim();

        if (field.numeric && yearError(value)) {
          nextErrors[field.name] = yearError(value);
          valid = false;
        }

        if (value) {
          cleanFilters[field.name] = value;
        }
      }
    }

    setErrors(nextErrors);

    if (!valid) {
      return;
    }

    router.push(
      discoverUrl({
        q: query.trim(),
        category: category,
        page: 1,
        filters: cleanFilters,
      }),
    );
  }

  let filterFields = null;

  if (category) {
    filterFields = (
      <div className="discover-filters">
        {categoryFilters[category].map(function (field) {
          const id = "filter-" + field.name;
          const error = errors[field.name];

          return (
            <div className="discover-field" key={field.name}>
              <Label htmlFor={id}>{field.label}</Label>
              <Input
                id={id}
                name={field.name}
                value={filters[field.name] || ""}
                placeholder={field.placeholder}
                inputMode={field.numeric ? "numeric" : undefined}
                maxLength={field.numeric ? 4 : maxFilterLength}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? id + "-error" : undefined}
                onChange={function (event) {
                  changeFilter(field.name, event.target.value);
                }}
              />
              {error ? (
                <p className="discover-field-error" id={id + "-error"}>
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="discover-controls">
      <div className="discover-categories" role="group" aria-label="Category">
        <Button
          type="button"
          variant={category === null ? "default" : "outline"}
          aria-pressed={category === null}
          className="discover-category"
          onClick={function () {
            chooseCategory(null);
          }}
        >
          All
        </Button>
        {categories.map(function (option) {
          return (
            <Button
              type="button"
              key={option.value}
              variant={category === option.value ? "default" : "outline"}
              aria-pressed={category === option.value}
              className="discover-category"
              onClick={function () {
                chooseCategory(option.value);
              }}
            >
              {option.label}
            </Button>
          );
        })}
      </div>

      <form role="search" className="discover-form" onSubmit={handleSubmit}>
        <div className="discover-search-row">
          <div className="discover-field discover-query">
            <Label htmlFor="discover-query">Search</Label>
            <Input
              id="discover-query"
              name="q"
              type="search"
              value={query}
              maxLength={maxQueryLength}
              placeholder="e.g. Dune, Radiohead, Balboa Park"
              onChange={function (event) {
                setQuery(event.target.value);
              }}
            />
          </div>
          {filterFields}
        </div>
        <div className="discover-form-buttons">
          <Button type="submit" className="discover-submit">
            <Search aria-hidden="true" />
            Search
          </Button>
          <Link href="/discover" className="discover-reset">
            Clear search
          </Link>
        </div>
      </form>
    </div>
  );
}
